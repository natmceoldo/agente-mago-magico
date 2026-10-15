import urllib.parse
import requests
import re
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

ENDPOINT = "https://aula-agente-lucas-resource.services.ai.azure.com/api/projects/aula-agente-lucas"
AGENT_NAME = "Natalia-Ceoldo"

def buscar_imagem_scryfall(nome_comandante: str) -> str:
    """Consome a API do Scryfall e retorna a URL da imagem normal da carta."""
    if not nome_comandante:
        return None
        
    # Limpa marcações de Markdown (*, _, `, []) e espaços
    nome_limpo = re.sub(r'[\*\_\`\[\]]', '', nome_comandante).strip()
    nome_encoded = urllib.parse.quote(nome_limpo)
    url = f"https://api.scryfall.com/cards/named?fuzzy={nome_encoded}"
    headers = {'User-Agent': 'CommanderBuilder/1.0'}
    
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if 'image_uris' in data:
                return data['image_uris']['normal']
            elif 'card_faces' in data and 'image_uris' in data['card_faces'][0]:
                return data['card_faces'][0]['image_uris']['normal']
    except Exception as e:
        print(f"Erro ao buscar imagem no Scryfall para '{nome_comandante}': {e}")
        
    return None

def extrair_nome_comandante(texto: str) -> str:
    """
    Extrai o nome do comandante do texto.
    1. Busca a tag explicita [COMANDANTE: Nome Exato]
    2. Se não achar, usa regex de fallback resiliente a vírgulas e aspas.
    """
    if not texto:
        return None

    # 1. Busca prioritária pela tag técnica
    tag_match = re.search(r'\[COMANDANTE:\s*([^\]]+)\]', texto, re.IGNORECASE)
    if tag_match:
        return tag_match.group(1).strip()

   # 2. Fallback: Procura variações de "Comandante: Nome" (aceita vírgulas no nome)
    fallback_match = re.search(
        r'(?:comandante|commander)\s*(?::|é|será)?\s*\*?\*?\[?([A-Za-z0-9\s,\'\"\-\:\!]+?)(?=\n|\*|\.|\(|\)|$)',
        texto,
        re.IGNORECASE
    )
    if fallback_match:
        nome = fallback_match.group(1).strip()
        if len(nome) <= 60:  # Evita capturar frases longas por engano
            return nome

    return None

def processar_mensagem_agente(user_message: str, conversation_id: str = None) -> dict:
    with (
        DefaultAzureCredential() as credential,
        AIProjectClient(
            endpoint=ENDPOINT,
            credential=credential,
            allow_preview=True,
        ) as project_client,
    ):
        openai_client = project_client.get_openai_client(agent_name=AGENT_NAME)

        if not conversation_id:
            conversation = openai_client.conversations.create()
            conversation_id = conversation.id

        response = openai_client.responses.create(
            conversation=conversation_id,
            input=[{"role": "user", "content": user_message}],
        )

        resposta_bruta = response.output_text

        # 1. Tenta extrair o comandante da resposta do agente ou da mensagem do usuário
        nome_comandante = extrair_nome_comandante(resposta_bruta) or extrair_nome_comandante(user_message)

        # 2. Se um comandante foi identificado, busca a imagem correspondente no Scryfall
        commander_image_url = None
        if nome_comandante:
            commander_image_url = buscar_imagem_scryfall(nome_comandante)

        # 3. Limpa a tag [COMANDANTE: ...] do texto exibido no chat para não poluir a tela
        resposta_exibicao = re.sub(r'\[COMANDANTE:\s*[^\]]+\]', '', resposta_bruta).strip()

        return {
            "resposta": resposta_exibicao,
            "conversation_id": conversation_id,
            "commander_image_url": commander_image_url
        }