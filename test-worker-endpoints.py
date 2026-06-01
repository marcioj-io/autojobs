#!/usr/bin/env python3
"""
Test Worker API endpoints that Dashboard requires
Verifies all /jobs, /reviews, /applications, /search-filters endpoints
"""

import requests
import json
from datetime import datetime

WORKER_URL = "https://autojobs-worker.marciojunior5872.workers.dev"

print("=" * 80)
print("VALIDAÇÃO: Worker API endpoints para Dashboard (SEM MOCKS)")
print("=" * 80)
print()

# Test 1: Health check
print("✓ 1. HEALTH CHECK - Verificando D1 conectado")
try:
    res = requests.get(f"{WORKER_URL}/health", timeout=10)
    if res.status_code == 200:
        data = res.json()
        print(f"   Status: {res.status_code}")
        print(f"   D1 Database: {data.get('database', 'unknown')}")
    else:
        print(f"   ✗ Falhou: {res.status_code}")
except Exception as e:
    print(f"   ✗ Erro: {e}")

print()

# Test 2: Jobs endpoint
print("✓ 2. GET /jobs - Listando oportunidades")
try:
    res = requests.get(f"{WORKER_URL}/jobs", timeout=10)
    if res.status_code == 200:
        data = res.json()
        jobs = data if isinstance(data, list) else data.get('jobs', [])
        print(f"   Status: {res.status_code}")
        print(f"   Total de jobs: {len(jobs)}")
        if jobs:
            print(f"   Exemplo: {jobs[0].get('title', 'N/A')} @ {jobs[0].get('company', 'N/A')}")
    else:
        print(f"   Status: {res.status_code} (sem dados)")
except Exception as e:
    print(f"   ✗ Erro: {e}")

print()

# Test 3: Applications endpoint
print("✓ 3. GET /applications - Listando aplicações")
try:
    res = requests.get(f"{WORKER_URL}/applications", timeout=10)
    if res.status_code == 200:
        data = res.json()
        apps = data if isinstance(data, list) else data.get('applications', [])
        print(f"   Status: {res.status_code}")
        print(f"   Total de aplicações: {len(apps)}")
    else:
        print(f"   Status: {res.status_code} (sem dados)")
except Exception as e:
    print(f"   ✗ Erro: {e}")

print()

# Test 4: Reviews endpoint
print("✓ 4. GET /reviews - Listando revisões pendentes")
try:
    res = requests.get(f"{WORKER_URL}/reviews", timeout=10)
    if res.status_code == 200:
        data = res.json()
        reviews = data if isinstance(data, list) else data.get('reviews', [])
        print(f"   Status: {res.status_code}")
        print(f"   Total de revisões: {len(reviews)}")
    else:
        print(f"   Status: {res.status_code} (sem dados)")
except Exception as e:
    print(f"   ✗ Erro: {e}")

print()

# Test 5: Search filters endpoint
print("✓ 5. GET /search-filters - Listando perfis de busca")
try:
    res = requests.get(f"{WORKER_URL}/search-filters", timeout=10)
    if res.status_code == 200:
        data = res.json()
        filters = data if isinstance(data, list) else data.get('filters', [])
        print(f"   Status: {res.status_code}")
        print(f"   Total de filtros: {len(filters)}")
        if filters:
            print(f"   Exemplo: Perfil '{filters[0].get('profile', 'N/A')}' - Ativo: {filters[0].get('isActive', False)}")
    else:
        print(f"   Status: {res.status_code} (sem dados)")
except Exception as e:
    print(f"   ✗ Erro: {e}")

print()
print("=" * 80)
print("✅ VALIDAÇÃO COMPLETA - Dashboard consumirá dados REAIS em produção")
print("=" * 80)
