# PowerShell: envio de payload JSON em UTF-8 (opção com/sem BOM)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Endpoint
$WORKER_URL = "https://autojobs-worker.marciojunior5872.workers.dev"
$ENDPOINT = "$WORKER_URL/profiles"

# Escolha: $false = sem BOM (padrão), $true = com BOM
$useBom = $false

Write-Host "Preparando payload..." -ForegroundColor Cyan

# === DEFINIÇÃO DO PROFILE ===
$profile = @{
    id = "perfil-unificado-001"
    name = "Desenvolvedor Backend/Full Stack"
    targetRoles = @(
        "Desenvolvedor .NET", "Desenvolvedor C#", "Engenheiro de Software .NET", "Software Engineer",
        "Backend Software Engineer", "Backend Developer C#", "Backend Developer", "Desenvolvedor Node.js",
        "Backend Node.js", "Node.js Developer", "Desenvolvedor TypeScript", "Engenheiro Backend Node",
        "Desenvolvedor Full Stack", "Full Stack Developer", "Full Stack Software Engineer",
        "Engenheiro Full Stack", "Full Stack React", "ASP.NET Core Developer", ".NET Software Engineer",
        "API Developer", "Application Developer", "Desenvolvedor de Software", "Software Developer",
        "Frontend Developer", "React Developer"
    )
    targetAreas = @(
        "Tecnologia", "Tecnologia da Informação", "Engenharia de Software", "Arquitetura de Software",
        "Cloud Computing", "Inteligência Artificial", "Automação", "Sistemas Financeiros", "Transportes",
        "Produto", "Plataformas", "SaaS", "Startups", "Consultoria"
    )
    seniority = @("Pleno", "Senior", "Pleno/Senior")
    searchLocation = @("Brasil", "São Paulo")
    allowedModalities = @("Remoto", "Híbrido")
    hybridCities = @("São Paulo", "Osasco")
    skillMatrix = @{
        backend = @{
            tools = @("C#", ".NET", "ASP.NET Core", "Web API", "Entity Framework Core", "LINQ", "Clean Architecture", "DDD", "SOLID", "TDD", "Repository Pattern", "Dependency Injection", "Microservices", "REST", "gRPC", "NestJS", "Express", "JWT", "Swagger", "OpenAPI", "Middleware", "Authentication", "Authorization")
            years = 5
            level = "especialista"
        }
        database = @{
            tools = @("SQL", "SQL Server", "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Entity Framework Core", "EF Core Migrations", "Database Modeling", "Query Optimization")
            years = 5
            level = "avançado"
        }
        frontend = @{
            tools = @("React", "TypeScript", "JavaScript", "Redux", "Zustand", "React Hooks", "Material UI", "TailwindCSS", "Zod", "Axios", "HTML", "CSS")
            years = 5
            level = "avançado"
        }
        infra = @{
            tools = @("Docker", "Docker Compose", "AWS", "EC2", "RDS", "S3", "Cloudflare", "RabbitMQ", "Git", "Azure DevOps", "CI/CD")
            years = 5
            level = "avançado"
        }
        cloud = @{
            tools = @("AWS", "EC2", "RDS", "S3", "Cloudflare", "Docker", "Docker Compose", "CI/CD")
            years = 5
            level = "avançado"
        }
        artificialIntelligence = @{
            tools = @("LLM", "Generative AI", "RAG", "Retrieval-Augmented Generation", "Embeddings", "Vector Search", "Semantic Search", "FAISS", "Sentence Transformers", "Prompt Engineering", "Ollama", "llama.cpp", "Mistral", "GPT4All", "Python", "FastAPI", "AI Orchestration", "Context Retrieval")
            years = 2
            level = "avançado"
        }
        automation = @{
            tools = @("Playwright", "Web Scraping", "Browser Automation", "Data Extraction", "Crawler", "Automation Scripts", "ETL", "Data Processing")
            years = 4
            level = "avançado"
        }
        architecture = @{
            tools = @("Clean Architecture", "DDD", "SOLID", "Microservices", "Layered Architecture", "Repository Pattern", "Dependency Injection", "Software Architecture", "API Design")
            years = 5
            level = "avançado"
        }
        security = @{
            tools = @("JWT", "CORS", "SQL Injection Prevention", "XSS Prevention", "CSRF Protection", "Authentication", "Authorization", "OWASP", "Input Validation")
            years = 5
            level = "avançado"
        }
        dataEngineering = @{
            tools = @("Data Pipelines", "Data Processing", "Data Normalization", "Information Retrieval", "Text Processing", "Document Processing", "Indexing")
            years = 3
            level = "avançado"
        }
    }
    languages = @{
        "Português" = "Nativo"
        "Inglês" = "B1"
    }
    negativeKeywords = @("Estágio", "Júnior", "Sênior", "Java", "Spring", "PHP", "Laravel", "Ruby", "Rails", "Angular", "Vue", "Delphi", "Cobol", "Django", "Flask", "Presencial", "specialist", "especialista", "sr", "jr", "tech lead", "lead", "trainee")
    minScore = 70
    dailyLimit = 40
    aiApplicationContext = "Desenvolvedor Full Stack nível Pleno com sólida experiência em desenvolvimento de software para sistemas corporativos, aplicações de missão crítica e plataformas de alto desempenho, atuando principalmente com C#, .NET, ASP.NET Core, Entity Framework Core, Node.js, TypeScript e React. Experiência profissional em projetos dos segmentos financeiro, transporte público, mídia digital, empregabilidade e educação, desenvolvendo soluções escaláveis, seguras e orientadas à qualidade. Experiência prática na construção de APIs REST, microsserviços, integrações entre sistemas, processamento assíncrono, filas de mensagens (RabbitMQ), cache distribuído (Redis), autenticação JWT, autorização baseada em perfis, versionamento de APIs, middlewares, tratamento global de exceções, validações, documentação com Swagger/OpenAPI e desenvolvimento de aplicações seguindo boas práticas de engenharia de software. Conhecimento sólido em Clean Architecture, Domain-Driven Design (DDD), SOLID, TDD, Injeção de Dependência, Repository Pattern, Service Layer, princípios de baixo acoplamento, alta coesão, arquitetura em camadas, modularização e desenvolvimento orientado à manutenção, escalabilidade e legibilidade."
}
# === FIM DO PROFILE ===

# Convert to JSON string
$jsonPayload = $profile | ConvertTo-Json -Depth 100

# Salva cópia local para inspeção (UTF-8 sem BOM)
# PowerShell 7: -Encoding utf8 escreve sem BOM; PowerShell 5.1: -Encoding utf8 escreve com BOM.
# Se precisar forçar sem BOM em PS5.1, use .NET File.WriteAllText com Encoding.UTF8 (sem preâmbulo).
Set-Content -Path ".\payload_utf8_nobom.json" -Value $jsonPayload -Encoding utf8

if ($useBom) {
    Write-Host "Construindo bytes com BOM..." -ForegroundColor Yellow
    $preamble = [System.Text.Encoding]::UTF8.GetPreamble()
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonPayload)
    $utf8Bytes = New-Object byte[] ($preamble.Length + $bodyBytes.Length)
    [Array]::Copy($preamble, 0, $utf8Bytes, 0, $preamble.Length)
    [Array]::Copy($bodyBytes, 0, $utf8Bytes, $preamble.Length, $bodyBytes.Length)

    # salva arquivo com BOM para inspeção
    [System.IO.File]::WriteAllBytes(".\payload_utf8_bom.json", $utf8Bytes)

    try {
        # Recomendo usar -Headers quando enviar byte[]; mantenho -ContentType por compatibilidade
        $response = Invoke-RestMethod `
            -Uri $ENDPOINT `
            -Method POST `
            -ContentType "application/json; charset=utf-8" `
            -Body $utf8Bytes

        Write-Host "✅ Perfil enviado (com BOM)!" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 20 | Write-Host -ForegroundColor DarkGray
    }
    catch {
        Write-Host "❌ Erro ao enviar (com BOM):" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        throw
    }
}
else {
    Write-Host "Enviando payload como string UTF-8 sem BOM..." -ForegroundColor Yellow

    try {
        $response = Invoke-RestMethod `
            -Uri $ENDPOINT `
            -Method POST `
            -ContentType "application/json; charset=utf-8" `
            -Body $jsonPayload

        Write-Host "✅ Perfil enviado (sem BOM)!" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 20 | Write-Host -ForegroundColor DarkGray
    }
    catch {
        Write-Host "❌ Erro ao enviar (sem BOM):" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        throw
    }
}
