# =====================================================
# auth.py - Autenticação Firebase via REST API
# Mesmo método do seu server.js (axios -> requests)
# Usa a FIREBASE_API_KEY do .env — sem SDK admin
# =====================================================
import os
import requests
from functools import wraps
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv()

FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")

def firebase_login(email, password):
    """Faz login no Firebase e retorna o idToken. Mesmo comportamento do seu /login."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    resp = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True})
    if resp.status_code == 200:
        return resp.json().get("idToken")
    return None

def verificar_token_firebase(token):
    """Verifica o token no Firebase. Mesmo comportamento do seu verificarToken()."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}"
    resp = requests.post(url, json={"idToken": token})
    return resp.status_code == 200

def token_required(f):
    """Decorator que protege rotas — exige token Firebase válido no header Authorization."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not token:
            return jsonify({"error": "Token não enviado"}), 401
        if not verificar_token_firebase(token):
            return jsonify({"error": "Token inválido"}), 401
        return f(*args, **kwargs)
    return decorated
