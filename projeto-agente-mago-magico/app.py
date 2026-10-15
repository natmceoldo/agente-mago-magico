from flask import Flask, render_template, request, jsonify
from agente import processar_mensagem_agente

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    dados = request.json or {}
    user_message = dados.get("message", "")
    conversation_id = dados.get("conversation_id", None)

    if not user_message:
        return jsonify({"error": "Mensagem vazia"}), 400

    try:
        # Chama o agente na Azure repassando o ID da conversa atual
        resultado = processar_mensagem_agente(user_message, conversation_id)
        
        return jsonify({
            "response": resultado["resposta"],
            "conversation_id": resultado["conversation_id"],
            "commander_image_url": resultado["commander_image_url"]
        })
    except Exception as e:
        print(f"Erro ao processar mensagem com a Azure: {e}")
        return jsonify({"response": f"Ocorreu um erro de comunicação com o agente: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)