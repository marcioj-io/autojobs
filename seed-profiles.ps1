$ErrorActionPreference = 'Stop'

# 🌐 URL DA SUA API (Worker)
# Se quiser rodar em produção, troque para a URL real do seu Worker no Cloudflare
$WORKER_URL = "https://autojobs-worker.marciojunior5872.workers.dev" 
$ENDPOINT = "$WORKER_URL/profiles"

Write-Host " Iniciando carga de perfis de busca..." -ForegroundColor Cyan
Write-Host "Destino: $ENDPOINT`n" -ForegroundColor DarkGray

# 📦 DADOS ESTRUTURADOS (Hashtables do PowerShell)
# Note o uso de aspas simples nos campos JSON (allowedModalities) para garantir a integridade.
$profiles = @(
    @{
        id = "81ee708f-414c-4841-87a0-203fc3fef754"
        name = "backend-dotnet-pleno"
        searches = "backend developer, .net developer, desenvolvedor c#, desenvolvedor backend"
        keywords = "backend, engineer, software, desenvolvedor, c#, dotnet, .net, asp.net core, web api, sql server, redis, docker, aws, ddd, clean architecture, tdd, entity framework"
        negativeKeywords = "php, java, spring, laravel, ruby, python, django, ingles fluente, english fluent, advanced english, fluent english, bilingual, estagio, junior, jr"
        minScore = 75
        dailyLimit = 15
        seniority = "pleno"
        stackPriority = "backend"
        cv = "default"
        searchLocation = "Brasil"
        allowedModalities = '["remoto", "híbrido"]'
        hybridCities = '["são paulo", "sp"]'
    },
    @{
        id = "36cbb659-7658-49ae-9380-58ad057e04fe"
        name = "backend-node-ai-pleno"
        searches = "backend developer, node.js developer, desenvolvedor node, software engineer"
        keywords = "backend, engineer, software, desenvolvedor, node.js, node, typescript, javascript, microservices, docker, aws, redis, mongodb, llm, mistral, gpt, api"
        negativeKeywords = "php, java, spring, laravel, ruby, ingles fluente, english fluent, advanced english, fluent english, bilingual, vue, angular, estagio, junior, jr"
        minScore = 75
        dailyLimit = 15
        seniority = "pleno"
        stackPriority = "backend"
        cv = "default"
        searchLocation = "Brasil"
        allowedModalities = '["remoto", "híbrido"]'
        hybridCities = '["são paulo", "sp"]'
    },
    @{
        id = "13926e37-82c3-4633-9de4-877360867f5e"
        name = "frontend-react-pleno"
        searches = "frontend developer, react developer, desenvolvedor frontend"
        keywords = "frontend, front-end, engineer, software, desenvolvedor, react, typescript, javascript, next.js, material ui, tailwind, redux, hooks, zod, jest"
        negativeKeywords = "php, java, vue, vue.js, angular, angularjs, wordpress, figma, ux, ui designer, ingles fluente, english fluent, advanced english, fluent english, bilingual, estagio, junior, jr"
        minScore = 75
        dailyLimit = 10
        seniority = "pleno"
        stackPriority = "frontend"
        cv = "default"
        searchLocation = "Brasil"
        allowedModalities = '["remoto", "híbrido"]'
        hybridCities = '["são paulo", "sp"]'
    },
    @{
        id = "c9dfabaf-f428-401e-951a-db91f5df1666"
        name = "fullstack-pleno"
        searches = "fullstack developer, desenvolvedor full stack, software engineer"
        keywords = "fullstack, full-stack, backend, frontend, engineer, software, desenvolvedor, c#, dotnet, node.js, typescript, react, sql server, mongodb, docker, aws, cloudflare"
        negativeKeywords = "php, java, ruby, spring, laravel, ingles fluente, english fluent, advanced english, fluent english, bilingual, estagio, junior, jr, senior"
        minScore = 80
        dailyLimit = 15
        seniority = "pleno"
        stackPriority = "fullstack"
        cv = "default"
        searchLocation = "Brasil"
        allowedModalities = '["remoto", "híbrido"]'
        hybridCities = '["são paulo", "sp"]'
    },
    @{
        id = "7f4d1cb0-bd65-4e0b-bdb3-cbe93e63d6fc"
        name = "desenvolvedor-backend-pleno"
        searches = "desenvolvedor backend, desenvolvedor back-end, dev backend, back end developer"
        keywords = "backend, back-end, engineer, software, desenvolvedor, c#, dotnet, .net, asp.net core, node.js, node, typescript, sql server, redis, mongodb, docker, rabbitmq, aws, clean architecture, web api, microservicos"
        negativeKeywords = "php, java, spring, laravel, ruby, python, django, ingles fluente, english fluent, advanced english, fluent english, bilingual, estagio, junior, jr"
        minScore = 75
        dailyLimit = 15
        seniority = "pleno"
        stackPriority = "backend"
        cv = "default"
        searchLocation = "Brasil"
        allowedModalities = '["remoto", "híbrido"]'
        hybridCities = '["são paulo", "sp"]'
    }
)

# 🔄 LOOP DE INSERÇÃO
foreach ($profile in $profiles) {
    Write-Host "Injetando perfil: " -NoNewline
    Write-Host "[$($profile.name)]" -ForegroundColor Yellow -NoNewline
    Write-Host " ... " -NoNewline
    
    # Converte a Hashtable para um JSON minificado e perfeitamente validado
    $jsonPayload = $profile | ConvertTo-Json -Depth 10 -Compress

    try {
        $response = Invoke-RestMethod -Uri $ENDPOINT `
                                      -Method Post `
                                      -Headers @{ "Content-Type" = "application/json" } `
                                      -Body $jsonPayload

        Write-Host "✅ SUCESSO!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ ERRO!" -ForegroundColor Red
        Write-Host "    Detalhes: $_" -ForegroundColor DarkGray
    }
}

Write-Host "`n Todos os perfis foram processados com sucesso!" -ForegroundColor Cyan