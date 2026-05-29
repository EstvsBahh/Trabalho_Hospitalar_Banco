from database import get_pg, get_mysql, test_pg, test_mysql
from datetime import datetime

def sincronizar():
    """Copia pacientes_triagem (PG) → painel_chamada (MySQL). Roda a cada 10s."""

    # Sai rápido se algum banco estiver fora — evita travar o CRON
    if not test_pg():
        print(f"[SYNC] {datetime.now().strftime('%H:%M:%S')} — PG indisponível, pulando")
        return
    if not test_mysql():
        print(f"[SYNC] {datetime.now().strftime('%H:%M:%S')} — MySQL indisponível, pulando")
        return

    try:
        pg = get_pg()
        cur = pg.cursor()
        cur.execute("""
            SELECT id_atendimento, nome_completo, consultorio_destino,
                   classificacao_risco, status_atendimento
            FROM pacientes_triagem
            ORDER BY criado_em DESC
        """)
        registros = cur.fetchall()
        cur.close()
        pg.close()

        my = get_mysql()
        my_cur = my.cursor()
        my_cur.execute("DELETE FROM painel_chamada")
        for r in registros:
            senha = f"A00{r['id_atendimento']}"
            my_cur.execute("""
                INSERT INTO painel_chamada (nome_paciente, senha, consultorio, status)
                VALUES (%s, %s, %s, %s)
            """, (r["nome_completo"], senha, r["consultorio_destino"], r["status_atendimento"]))
        my.commit()
        my_cur.close()
        my.close()
        print(f"[SYNC] {datetime.now().strftime('%H:%M:%S')} — {len(registros)} registros sincronizados")

    except Exception as e:
        print(f"[SYNC ERROR] {datetime.now().strftime('%H:%M:%S')} — {e}")
