import os
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from dotenv import load_dotenv

from database import get_pg, get_mysql, test_pg, test_mysql
from auth import firebase_login, token_required
from sync import sincronizar

load_dotenv()

app = Flask(__name__)
CORS(app)

# CRON com executor dedicado e max_instances=1 para nunca empilhar jobs
executors = {"default": ThreadPoolExecutor(1)}
scheduler = BackgroundScheduler(executors=executors)
scheduler.add_job(sincronizar, "interval", seconds=15, id="sync_job", max_instances=1, coalesce=True)
scheduler.start()
print("[CRON] Sincronização PG→MySQL iniciada (a cada 15s)")


@app.route("/")
def index():
    return jsonify({"mensagem": "API Triagem Hospitalar funcionando"})


@app.route("/health")
def health():
    return jsonify({"postgresql": test_pg(), "mysql": test_mysql()})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    token = firebase_login(data.get("email", ""), data.get("password", ""))
    if token:
        return jsonify({"token": token})
    return jsonify({"error": "Login inválido"}), 401


@app.route("/triagem", methods=["POST"])
@token_required
def cadastrar_triagem():
    data = request.get_json() or {}

    nome        = data.get("nome_completo", "").strip()
    cpf         = data.get("cpf", "").strip()
    nascimento  = data.get("data_nascimento", "")
    sintomas    = data.get("sintomas", "")
    sinais      = data.get("sinais_vitais", {})
    classif     = data.get("classificacao_risco", "Verde")
    consultorio = data.get("consultorio_destino", 1)

    if not nome or not cpf or not nascimento:
        return jsonify({"error": "nome_completo, cpf e data_nascimento são obrigatórios"}), 400

    if not test_pg():
        return jsonify({"error": "Sistema de cadastro indisponível"}), 503

    try:
        pg = get_pg()
        cur = pg.cursor()
        cur.execute("""
            INSERT INTO pacientes_triagem
                (nome_completo, cpf, data_nascimento, sintomas,
                 sinais_vitais, classificacao_risco, consultorio_destino, status_atendimento)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'Aguardando')
            RETURNING id_atendimento
        """, (nome, cpf, nascimento, sintomas, json.dumps(sinais), classif, consultorio))
        id_atend = cur.fetchone()["id_atendimento"]
        senha = f"A00{id_atend}"
        pg.commit()
        cur.close()
        pg.close()
    except Exception as e:
        return jsonify({"error": f"Erro PostgreSQL: {str(e)}"}), 500

    # Sincroniza imediatamente no MySQL (sem travar se falhar)
    try:
        if test_mysql():
            my = get_mysql()
            my_cur = my.cursor()
            my_cur.execute("""
                INSERT INTO painel_chamada (nome_paciente, senha, consultorio, status)
                VALUES (%s, %s, %s, 'Aguardando')
            """, (nome, senha, consultorio))
            my.commit()
            my_cur.close()
            my.close()
    except Exception as e:
        print(f"[MYSQL] Sincronização imediata falhou (CRON vai compensar): {e}")

    return jsonify({"mensagem": "Paciente cadastrado", "id": id_atend, "senha": senha}), 201


@app.route("/triagem/<int:id>", methods=["PUT"])
@token_required
def atualizar_triagem(id):
    data = request.get_json() or {}
    status      = data.get("status_atendimento")
    consultorio = data.get("consultorio_destino")

    if not test_pg():
        return jsonify({"error": "Sistema de cadastro indisponível"}), 503

    try:
        pg = get_pg()
        cur = pg.cursor()
        if status and consultorio:
            cur.execute("UPDATE pacientes_triagem SET status_atendimento=%s, consultorio_destino=%s WHERE id_atendimento=%s RETURNING *", (status, consultorio, id))
        elif status:
            cur.execute("UPDATE pacientes_triagem SET status_atendimento=%s WHERE id_atendimento=%s RETURNING *", (status, id))
        elif consultorio:
            cur.execute("UPDATE pacientes_triagem SET consultorio_destino=%s WHERE id_atendimento=%s RETURNING *", (consultorio, id))
        else:
            return jsonify({"error": "Informe status_atendimento ou consultorio_destino"}), 400

        row = cur.fetchone()
        if not row:
            pg.close()
            return jsonify({"error": "Não encontrado"}), 404
        result = dict(row)
        pg.commit()
        cur.close()
        pg.close()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/painel")
def painel():
    if test_mysql():
        try:
            my = get_mysql()
            cur = my.cursor(dictionary=True)
            cur.execute("SELECT nome_paciente, senha, consultorio, status, atualizado_em FROM painel_chamada ORDER BY atualizado_em DESC")
            rows = cur.fetchall()
            cur.close()
            my.close()
            return jsonify({"degradado": False, "fonte": "mysql", "dados": rows})
        except Exception as e:
            print(f"[PAINEL] MySQL falhou: {e}")

    if test_pg():
        try:
            pg = get_pg()
            cur = pg.cursor()
            cur.execute("""
                SELECT id_atendimento AS id, nome_completo AS nome_paciente,
                       consultorio_destino AS consultorio,
                       status_atendimento AS status, criado_em AS atualizado_em
                FROM pacientes_triagem ORDER BY criado_em DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            pg.close()
            return jsonify({"degradado": True, "fonte": "postgresql_fallback", "dados": rows})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Todos os bancos indisponíveis"}), 503


@app.route("/fila")
def fila():
    if test_mysql():
        try:
            my = get_mysql()
            cur = my.cursor(dictionary=True)
            cur.execute("SELECT * FROM painel_chamada WHERE status='Aguardando' ORDER BY atualizado_em")
            rows = cur.fetchall()
            cur.close()
            my.close()
            return jsonify({"degradado": False, "dados": rows})
        except Exception:
            pass

    if test_pg():
        pg = get_pg()
        cur = pg.cursor()
        cur.execute("SELECT * FROM pacientes_triagem WHERE status_atendimento='Aguardando' ORDER BY criado_em")
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()
        pg.close()
        return jsonify({"degradado": True, "dados": rows})

    return jsonify({"error": "Bancos indisponíveis"}), 503


@app.route("/consultorios")
def consultorios():
    if not test_mysql():
        return jsonify({"error": "MySQL indisponível"}), 503
    my = get_mysql()
    cur = my.cursor(dictionary=True)
    cur.execute("SELECT * FROM consultorio ORDER BY numero")
    rows = cur.fetchall()
    cur.close()
    my.close()
    return jsonify(rows)


@app.route("/resumo")
def resumo():
    if not test_pg():
        return jsonify({"error": "PostgreSQL indisponível"}), 503
    pg = get_pg()
    cur = pg.cursor()
    cur.execute("SELECT status_atendimento AS status, COUNT(*) AS total FROM pacientes_triagem GROUP BY status_atendimento")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    pg.close()
    return jsonify(rows)


@app.route("/consistencia")
def consistencia():
    resultado = {"postgresql": 0, "mysql": 0, "sincronizado": False}
    if test_pg():
        pg = get_pg()
        cur = pg.cursor()
        cur.execute("SELECT COUNT(*) AS total FROM pacientes_triagem")
        resultado["postgresql"] = cur.fetchone()["total"]
        cur.close()
        pg.close()
    if test_mysql():
        my = get_mysql()
        cur = my.cursor(dictionary=True)
        cur.execute("SELECT COUNT(*) AS total FROM painel_chamada")
        resultado["mysql"] = cur.fetchone()["total"]
        cur.close()
        my.close()
    resultado["sincronizado"] = resultado["postgresql"] == resultado["mysql"]
    return jsonify(resultado)


@app.route("/pacientes")
def listar_pacientes():
    # Tenta PostgreSQL primeiro
    if test_pg():
        try:
            pg = get_pg()
            cur = pg.cursor()
            cur.execute("""
                SELECT id_atendimento, nome_completo, cpf, data_nascimento,
                       classificacao_risco, status_atendimento, consultorio_destino, criado_em
                FROM pacientes_triagem ORDER BY criado_em DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            pg.close()
            return jsonify(rows)
        except Exception as e:
            print(f"[PG] erro em /pacientes: {e}")

    # Fallback para MySQL
    if test_mysql():
        try:
            my = get_mysql()
            cur = my.cursor(dictionary=True)
            cur.execute("""
                SELECT id AS id_atendimento, nome_paciente AS nome_completo,
                       senha, consultorio AS consultorio_destino,
                       status AS status_atendimento, atualizado_em AS criado_em
                FROM painel_chamada ORDER BY atualizado_em DESC
            """)
            rows = cur.fetchall()
            cur.close()
            my.close()
            return jsonify(rows)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Todos os bancos indisponíveis"}), 503

if __name__ == "__main__":
    print("=" * 55)
    print("  TRIAGEM HOSPITALAR — API Python/Flask")
    print("  Projeto 5 — Banco de Dados Distribuído CQRS")
    print("  PostgreSQL: Supabase  |  MySQL: Railway")
    print("=" * 55)
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port, use_reloader=False)
