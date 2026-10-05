#!/usr/bin/env bash
# Выкладка лендинга на хостинг Sprinthost одной командой:
#   bash tools/deploy.sh
#
# Что делает:
# 1. Берёт текущий локальный коммит (HEAD). К GitHub не обращается: ни pull, ни fetch, ни push.
#    Если в проекте есть незакоммиченные изменения, останавливается — сначала сделайте коммит.
# 2. Делает на сервере бэкап текущего корня сайта в ~/backup_<дата-время>/t-invest.
# 3. Выкладывает файлы сайта (страницы, стили, скрипты, картинки, .htaccess) в корень сайта.
#    Файлы перезаписываются, но ничего не удаляется: если файл убрали из репозитория,
#    на сервере его нужно удалить вручную.
#    Выложенный коммит записывается в ~/t-invest-deployed.txt на сервере (вне папки сайта).
# 4. Проверяет, что главная, оферта и политика открываются.
#
# ВНИМАНИЕ. Поддомен t-invest.boxguide.ru живёт в папке public_html/t-invest ВНУТРИ корня
# сайта boxguide.ru (~/domains/boxguide.ru/public_html). При любых выкладках на boxguide.ru
# папку public_html/t-invest нельзя удалять или перезаписывать: rsync --delete, очистка
# public_html, распаковка архива поверх всего корня и т. п. сотрут этот лендинг.
# Выкладку boxguide.ru делайте с исключением t-invest/ (например, rsync --exclude 't-invest/').
#
# Нужно: Git Bash (git, ssh, tar) и алиас «sprint» в ~/.ssh/config (вход по ключу).
set -euo pipefail

SSH_HOST="sprint"
SITE_ROOT="domains/boxguide.ru/public_html/t-invest"   # от домашней папки на сервере
BACKUP_PREFIX="backup_"                                # бэкап: ~/backup_<дата-время>/t-invest
SITE_URL="https://t-invest.boxguide.ru"
DEPLOYED_FILE="t-invest-deployed.txt"                  # от домашней папки на сервере
# Что выкладывать. README, docs-src/ и tools/ на хостинг не нужны.
FILES=(index.html oferta.html privacy.html styles.css script.js images)
# BatchMode — без запроса пароля; LogLevel=ERROR — без информационных предупреждений ssh
SSH_OPTS=(-o BatchMode=yes -o LogLevel=ERROR)

# Корень проекта — на уровень выше папки tools, откуда бы ни запускали скрипт
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "1/4 Проверяю локальный коммит…"
# Выкладывается только закоммиченное: правки, не попавшие в коммит, на сайт бы не ушли
if [ -n "$(git -C "$SRC" status --porcelain)" ]; then
  echo "    Есть незакоммиченные изменения — сначала сделайте коммит:" >&2
  git -C "$SRC" status --short >&2
  exit 1
fi
COMMIT="$(git -C "$SRC" log -1 --format='%h %s')"
COMMIT_FULL="$(git -C "$SRC" rev-parse HEAD)"
BRANCH="$(git -C "$SRC" rev-parse --abbrev-ref HEAD)"
echo "    версия: $COMMIT ($BRANCH)"

# Файл .htaccess (например, с редиректом) выкладывается, только если он есть в коммите
if git -C "$SRC" cat-file -e HEAD:.htaccess 2>/dev/null; then FILES+=(.htaccess); fi

echo "2/4 Бэкап текущего сайта на сервере…"
BACKUP="${BACKUP_PREFIX}$(date +%Y%m%d-%H%M%S)/t-invest"
ssh "${SSH_OPTS[@]}" "$SSH_HOST" \
  "mkdir -p ~/$BACKUP && cp -a ~/$SITE_ROOT/. ~/$BACKUP/ && echo '    бэкап: ~/$BACKUP'"

echo "3/4 Выкладываю файлы…"
# core.autocrlf=false: файлы уходят на сервер байт в байт как в репозитории (LF).
# Иначе при autocrlf=true из настроек Git для Windows архив получил бы CRLF.
git -C "$SRC" -c core.autocrlf=false archive --format=tar HEAD "${FILES[@]}" \
  | ssh "${SSH_OPTS[@]}" "$SSH_HOST" "umask 022 && tar -x -C ~/$SITE_ROOT && echo '    готово'"
ssh "${SSH_OPTS[@]}" "$SSH_HOST" \
  "printf '%s\n%s\n%s\n' '$COMMIT_FULL' \"\$(date '+%Y-%m-%d %H:%M:%S %z')\" '$BRANCH' > ~/$DEPLOYED_FILE \
   && echo '    коммит записан в ~/$DEPLOYED_FILE'"

echo "4/4 Проверяю сайт…"
for page in / /oferta.html /privacy.html; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL$page" || true)"
  if [ "$code" = "000" ]; then
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://${SITE_URL#https://}$page" || true) (по http: https не ответил)"
  fi
  echo "    $page → $code"
done
echo "Выложено: $COMMIT"
