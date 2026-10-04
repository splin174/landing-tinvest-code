#!/usr/bin/env bash
# Выкладка лендинга на хостинг Sprinthost одной командой:
#   bash tools/deploy.sh
#
# Что делает:
# 1. Скачивает свежую версию ветки main из GitHub во временную папку.
# 2. Делает на сервере бэкап текущего корня сайта в ~/backup_<дата-время>/t-invest.
# 3. Выкладывает файлы сайта (страницы, стили, скрипты, картинки, .htaccess) в корень сайта.
#    Файлы перезаписываются, но ничего не удаляется: если файл убрали из репозитория,
#    на сервере его нужно удалить вручную.
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

REPO="git@github-splin174:splin174/landing-tinvest-code.git"
BRANCH="main"
SSH_HOST="sprint"
SITE_ROOT="domains/boxguide.ru/public_html/t-invest"   # от домашней папки на сервере
BACKUP_PREFIX="backup_"                                # бэкап: ~/backup_<дата-время>/t-invest
SITE_URL="https://t-invest.boxguide.ru"
# Что выкладывать. README, docs-src/ и tools/ на хостинг не нужны.
FILES=(index.html oferta.html privacy.html styles.css script.js images)
# BatchMode — без запроса пароля; LogLevel=ERROR — без информационных предупреждений ssh
SSH_OPTS=(-o BatchMode=yes -o LogLevel=ERROR)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "1/4 Скачиваю $BRANCH из GitHub…"
git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$TMP/src"
COMMIT="$(git -C "$TMP/src" log -1 --format='%h %s')"
echo "    версия: $COMMIT"

# Файл .htaccess (например, с редиректом) выкладывается, только если он есть в репозитории
if [ -f "$TMP/src/.htaccess" ]; then FILES+=(.htaccess); fi

echo "2/4 Бэкап текущего сайта на сервере…"
BACKUP="${BACKUP_PREFIX}$(date +%Y%m%d-%H%M%S)/t-invest"
ssh "${SSH_OPTS[@]}" "$SSH_HOST" \
  "mkdir -p ~/$BACKUP && cp -a ~/$SITE_ROOT/. ~/$BACKUP/ && echo '    бэкап: ~/$BACKUP'"

echo "3/4 Выкладываю файлы…"
git -C "$TMP/src" archive --format=tar HEAD "${FILES[@]}" \
  | ssh "${SSH_OPTS[@]}" "$SSH_HOST" "umask 022 && tar -x -C ~/$SITE_ROOT && echo '    готово'"

echo "4/4 Проверяю сайт…"
for page in / /oferta.html /privacy.html; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL$page" || true)"
  if [ "$code" = "000" ]; then
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://${SITE_URL#https://}$page" || true) (по http: https не ответил)"
  fi
  echo "    $page → $code"
done
echo "Выложено: $COMMIT"
