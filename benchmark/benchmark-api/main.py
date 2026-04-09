from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import json
import os
import hashlib
import uuid
import base64
import io
import traceback
import time
import requests
import psutil

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor, 
    GradientBoostingClassifier, GradientBoostingRegressor
)
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.metrics import accuracy_score, r2_score

from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware allowing all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# PART 1 - Redis cache functions
def get_cache(cache_key):
    try:
        url = f"{os.getenv('UPSTASH_REDIS_REST_URL')}/get/{cache_key}"
        headers = {"Authorization": f"Bearer {os.getenv('UPSTASH_REDIS_REST_TOKEN')}"}
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            result = response.json().get("result")
            if result is not None:
                return json.loads(result)
        return None
    except Exception as e:
        return None

def set_cache(cache_key, data):
    try:
        url = f"{os.getenv('UPSTASH_REDIS_REST_URL')}/set/{cache_key}"
        headers = {"Authorization": f"Bearer {os.getenv('UPSTASH_REDIS_REST_TOKEN')}"}
        body = {"value": json.dumps(data), "ex": 86400}
        requests.post(url, headers=headers, json=body)
    except Exception as e:
        pass

# PART 2 - Supabase save function
def save_to_supabase(session_id, file_name, target_column, task_type, results, best_model, ai_report):
    try:
        url = f"{os.getenv('SUPABASE_URL')}/rest/v1/benchmark_sessions"
        headers = {
            "apikey": os.getenv("SUPABASE_KEY", ""),
            "Authorization": f"Bearer {os.getenv('SUPABASE_KEY', '')}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        body = {
            "session_id": session_id,
            "file_name": file_name,
            "target_column": target_column,
            "task_type": task_type,
            "results": json.dumps(results),
            "best_model": best_model,
            "ai_report": ai_report
        }
        response = requests.post(url, headers=headers, json=body)
        print(f"Status code: {response.status_code}")
        if response.status_code != 201:
            print(response.text)
    except Exception as e:
        print(f"Error saving to supabase: {e}")

# PART 3 - History endpoint
@app.get("/history")
def get_history():
    try:
        url = f"{os.getenv('SUPABASE_URL')}/rest/v1/benchmark_sessions?select=*&order=created_at.desc&limit=10"
        headers = {
            "apikey": os.getenv("SUPABASE_KEY", ""),
            "Authorization": f"Bearer {os.getenv('SUPABASE_KEY', '')}"
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        return []

# PART 4 - preprocess_data function
def preprocess_data(df, target_column):
    initial_len = len(df)
    df = df.dropna(subset=[target_column])
    dropped = initial_len - len(df)
    print(f"Dropped {dropped} rows due to NaN in target column")
    
    if len(df) < 10:
        raise ValueError("Dataset has fewer than 10 valid rows after dropping NaNs algorithmically.")
        
    X = df.drop(columns=[target_column])
    y = df[target_column]
    
    if y.nunique() < 20:
        task_type = "classification"
    else:
        task_type = "regression"
    
    # Drop columns from X where missing values > 50%
    missing_ratio = X.isnull().mean()
    cols_to_drop = missing_ratio[missing_ratio > 0.5].index
    X = X.drop(columns=cols_to_drop)
    
    # Fill remaining missing numeric columns with median
    numeric_cols = X.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if X[col].isnull().any():
            X[col] = X[col].fillna(X[col].median())
            
    # Fill remaining missing non-numeric columns with mode
    non_numeric_cols = X.select_dtypes(exclude=[np.number]).columns
    for col in non_numeric_cols:
        if X[col].isnull().any():
            if not X[col].mode().empty:
                X[col] = X[col].fillna(X[col].mode()[0])
            else:
                X[col] = X[col].fillna("Unknown")
                
    # For each non-numeric column in X apply LabelEncoder
    le = LabelEncoder()
    for col in non_numeric_cols:
        X[col] = le.fit_transform(X[col].astype(str))
        
    feature_names = X.columns.tolist()
    return X.to_numpy(), y.to_numpy(), feature_names, task_type

# PART 5 - run_benchmark function
def run_benchmark(X, y, task_type):
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)
    
    if task_type == 'classification':
        models = {
            "Logistic Regression": LogisticRegression(max_iter=1000),
            "Decision Tree": DecisionTreeClassifier(random_state=42),
            "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
            "Gradient Boosting": GradientBoostingClassifier(random_state=42),
            "KNN": KNeighborsClassifier()
        }
    else:
        models = {
            "Linear Regression": LinearRegression(),
            "Decision Tree": DecisionTreeRegressor(random_state=42),
            "Random Forest": RandomForestRegressor(n_estimators=100, random_state=42),
            "Gradient Boosting": GradientBoostingRegressor(random_state=42),
            "KNN": KNeighborsRegressor()
        }
        
    results = {}
    trained_models = {}
    
    for model_name, model in models.items():
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024
        
        start_time = time.time()
        model.fit(X_train, y_train)
        training_time = round((time.time() - start_time) * 1000, 2)
        
        memory_after = process.memory_info().rss / 1024 / 1024
        memory_used = round(memory_after - memory_before, 2)
        
        y_pred = model.predict(X_test)
        
        if task_type == 'classification':
            score = round(accuracy_score(y_test, y_pred) * 100, 2)
        else:
            score = round(r2_score(y_test, y_pred), 4)
            
        results[model_name] = {
            "score": score,
            "training_time": training_time,
            "memory_used": memory_used
        }
        trained_models[model_name] = model
        
    return results, trained_models

# PART 6 - get_feature_importance function
def get_feature_importance(models_dict, feature_names, task_type):
    model = None
    if "Random Forest" in models_dict:
        model = models_dict["Random Forest"]
    elif "Gradient Boosting" in models_dict:
        model = models_dict["Gradient Boosting"]
    elif "Decision Tree" in models_dict:
        model = models_dict["Decision Tree"]
        
    if model is not None and hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        feature_importance_list = [
            {"feature": feature_names[i], "importance": float(importances[i])} 
            for i in range(len(feature_names))
        ]
        feature_importance_list.sort(key=lambda x: x["importance"], reverse=True)
        return feature_importance_list[:10]
        
    return []

# PART 7 - generate_report function
def generate_report(results, best_model, task_type, file_name):
    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an ML expert. Given benchmark results recommend which model to use and why. Be specific and under 100 words."
                },
                {
                    "role": "user",
                    "content": f"File: {file_name} Task: {task_type} Best model: {best_model} Results: {json.dumps(results)}"
                }
            ]
        }
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            data = response.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "Report unavailable")
        return "Report unavailable"
    except Exception as e:
        return "Report unavailable"

# PART 8 - WebSocket endpoint
@app.websocket("/ws/benchmark")
async def websocket_benchmark(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connected")
    
    try:
        raw_data = await websocket.receive_text()
        data = json.loads(raw_data)
        
        filename = data.get("filename")
        base64_data = data.get("data")
        target_column = data.get("target_column")
        task_type = data.get("task_type")
        
        print("Data received")
        
        decoded_bytes = base64.b64decode(base64_data)
        hash_input = decoded_bytes + target_column.encode('utf-8') + task_type.encode('utf-8')
        cache_key = hashlib.md5(hash_input).hexdigest()
        
        await websocket.send_json({"step": "Checking cache...", "progress": 5})
        
        cached_result = get_cache(cache_key)
        if cached_result:
            await websocket.send_json({"step": "Checking cache...", "progress": 95})
            cached_result["progress"] = 100
            await websocket.send_json(cached_result)
            return
            
        await websocket.send_json({"step": "Parsing CSV...", "progress": 15})
        df = pd.read_csv(io.BytesIO(decoded_bytes))
        
        if target_column not in df.columns:
            await websocket.send_json({"error": f"Target column '{target_column}' not found"})
            await websocket.close()
            return
            
        await websocket.send_json({"step": "Preprocessing data...", "progress": 25})
        X, y, feature_names, task_type = preprocess_data(df, target_column)
        
        await websocket.send_json({"step": "Training Logistic Regression...", "progress": 35})
        await websocket.send_json({"step": "Training Decision Tree...", "progress": 45})
        await websocket.send_json({"step": "Training Random Forest...", "progress": 55})
        await websocket.send_json({"step": "Training Gradient Boosting...", "progress": 65})
        await websocket.send_json({"step": "Training KNN...", "progress": 75})
        
        results_dict, models_dict = run_benchmark(X, y, task_type)
        best_model = max(results_dict, key=lambda k: results_dict[k]["score"])
        importance_list = get_feature_importance(models_dict, feature_names, task_type)
        
        await websocket.send_json({"step": "Generating AI report...", "progress": 85})
        ai_report = generate_report(results_dict, best_model, task_type, filename)
        
        await websocket.send_json({"step": "Saving to history...", "progress": 92})
        
        session_id = str(uuid.uuid4())
        
        final_result = {
            "step": "Complete",
            "progress": 100,
            "results": results_dict,
            "best_model": best_model,
            "feature_importance": importance_list,
            "ai_report": ai_report,
            "session_id": session_id,
            "detected_task_type": task_type
        }
        
        set_cache(cache_key, final_result)
        save_to_supabase(session_id, filename, target_column, task_type, results_dict, best_model, ai_report)
        
        await websocket.send_json(final_result)
        
    except WebSocketDisconnect:
        pass
    except Exception as e:
        traceback.print_exc()
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass

# PART 9 - Health check
@app.get("/health")
def health_check():
    return {"status": "ok"}
