#!/usr/bin/env bash
# Запросы к API Яндекс Метрики (только чтение) для счётчика лендинга.
#
#   bash tools/metrika.sh counters                    — счётчики аккаунта
#   bash tools/metrika.sh goals-list                  — цели счётчика
#   bash tools/metrika.sh summary [с] [по]            — визиты, посетители, отказы, глубина, время по дням
#   bash tools/metrika.sh sources [с] [по]            — источники трафика
#   bash tools/metrika.sh goals [с] [по]              — достижения целей
#   bash tools/metrika.sh raw <путь> [параметры]      — любой GET, ответ в JSON
#
# Даты: YYYY-MM-DD, today, yesterday, NdaysAgo. По умолчанию — последние 7 дней (6daysAgo … today).
# Пример: bash tools/metrika.sh sources 2026-10-01 today
#
# Токен: переменная YANDEX_METRIKA_TOKEN, иначе файл ~/.metrika_token (только для владельца, chmod 600).
# Токен не выводится и не передаётся в аргументах команд: curl получает его через stdin.
# Номер счётчика можно переопределить переменной METRIKA_COUNTER.
# Нужно: Git Bash (curl) и Python 3 — он собирает из ответа таблицы.
set -euo pipefail

COUNTER="${METRIKA_COUNTER:-113395885}"
API="https://api-metrika.yandex.net"
TOKEN_FILE="$HOME/.metrika_token"

load_token() {
  if [ -n "${YANDEX_METRIKA_TOKEN:-}" ]; then
    TOKEN="$YANDEX_METRIKA_TOKEN"
  elif [ -f "$TOKEN_FILE" ]; then
    TOKEN="$(tr -d ' \r\n' < "$TOKEN_FILE")"
  else
    echo "Нет токена: задайте YANDEX_METRIKA_TOKEN или положите его в $TOKEN_FILE" >&2
    exit 1
  fi
  if [ -z "$TOKEN" ]; then echo "Токен пустой" >&2; exit 1; fi
}

# GET к API: $1 — путь, $2 — строка параметров (уже в URL-кодировке). Ответ — JSON в stdout.
api_get() {
  local url="$API$1"
  [ -n "${2:-}" ] && url="$url?$2"
  local out code
  out="$(printf 'header = "Authorization: OAuth %s"\n' "$TOKEN" \
    | curl -sS -K - -w '\n%{http_code}' --max-time 60 "$url")"
  code="${out##*$'\n'}"
  out="${out%$'\n'*}"
  if [ "$code" != "200" ]; then
    echo "Ошибка API: HTTP $code" >&2
    printf '%s\n' "$out" | python -c 'import sys,json
try:
    d=json.load(sys.stdin); print(d.get("message") or d, file=sys.stderr)
except Exception: pass' || true
    exit 1
  fi
  printf '%s\n' "$out"
}

# Таблица из ответа /stat/v1/data: заголовки — подписи, строки — измерения и метрики
print_table() {
  python -X utf8 -c '
import sys, json
labels = sys.argv[1].split("|")
d = json.load(sys.stdin)
rows = []
for r in d.get("data", []):
    dims = [x.get("name") or x.get("id") or "—" for x in r["dimensions"]]
    mets = []
    for v in r["metrics"]:
        mets.append("—" if v is None else (str(int(v)) if float(v).is_integer() else f"{v:.2f}"))
    rows.append(dims + mets)
tot = d.get("totals")
if tot is not None and rows:
    n = len(rows[0]) - len(tot)
    rows.append(["Итого"] + [""] * (n - 1) + [("—" if v is None else (str(int(v)) if float(v).is_integer() else f"{v:.2f}")) for v in tot])
w = [max(len(labels[i]), *(len(r[i]) for r in rows)) if rows else len(labels[i]) for i in range(len(labels))]
print("  ".join(labels[i].ljust(w[i]) for i in range(len(labels))))
print("  ".join("-" * w[i] for i in range(len(labels))))
for r in rows:
    print("  ".join(r[i].ljust(w[i]) for i in range(len(r))))
if not rows:
    print("(нет данных за период)")
' "$1"
}

D1="${2:-6daysAgo}"
D2="${3:-today}"
STAT="ids=$COUNTER&date1=$D1&date2=$D2&accuracy=full&limit=100"

cmd="${1:-help}"
case "$cmd" in
  counters)
    load_token
    json="$(api_get /management/v1/counters)"
    printf '%s' "$json" | python -X utf8 -c '
import sys, json
for c in json.load(sys.stdin).get("counters", []):
    print("{}  {}  {}  ({})".format(c["id"], c.get("name", ""), c.get("site", ""), c.get("status", "")))'
    ;;
  goals-list)
    load_token
    json="$(api_get "/management/v1/counter/$COUNTER/goals")"
    printf '%s' "$json" | python -X utf8 -c '
import sys, json
goals = json.load(sys.stdin).get("goals", [])
for g in goals:
    conds = ", ".join("{}={}".format(c.get("type"), c.get("url")) for c in g.get("conditions", []))
    print("{}  {}  [{}]  {}".format(g["id"], g.get("name", ""), g.get("type"), conds))
if not goals:
    print("(целей нет)")'
    ;;
  summary)
    load_token
    json="$(api_get /stat/v1/data "$STAT&metrics=ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds&dimensions=ym:s:date&sort=ym:s:date")"
    printf '%s' "$json" | print_table "Дата|Визиты|Посетители|Отказы, %|Глубина|Время, с"
    ;;
  sources)
    load_token
    json="$(api_get /stat/v1/data "$STAT&metrics=ym:s:visits,ym:s:users,ym:s:bounceRate&dimensions=ym:s:lastTrafficSource&sort=-ym:s:visits")"
    printf '%s' "$json" | print_table "Источник|Визиты|Посетители|Отказы, %"
    ;;
  goals)
    load_token
    goals_json="$(api_get "/management/v1/counter/$COUNTER/goals")"
    # Первые 20 целей: метрики ym:s:goal<ID>reaches и подписи столбцов
    plan="$(printf '%s' "$goals_json" | python -X utf8 -c '
import sys, json
goals = json.load(sys.stdin).get("goals", [])[:20]
if goals:
    print(",".join("ym:s:goal{}reaches".format(g["id"]) for g in goals))
    print("|".join(g.get("name", str(g["id"])).replace("|", "/") for g in goals))')"
    if [ -z "$plan" ]; then echo "(целей нет)"; exit 0; fi
    metrics="$(printf '%s\n' "$plan" | sed -n 1p)"
    names="$(printf '%s\n' "$plan" | sed -n 2p)"
    json="$(api_get /stat/v1/data "$STAT&metrics=$metrics&dimensions=ym:s:date&sort=ym:s:date")"
    printf '%s' "$json" | print_table "Дата|$names"
    ;;
  raw)
    load_token
    [ -n "${2:-}" ] || { echo "Использование: bash tools/metrika.sh raw <путь> [параметры]" >&2; exit 1; }
    api_get "$2" "${3:-}"
    ;;
  *)
    sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
