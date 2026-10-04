#!/usr/bin/env bash
# Выкладка лендинга на хостинг Sprinthost одной командой:
#   bash tools/deploy.sh
#
# Что делает:
# 1. Скачивает свежую версию ветки main из GitHub во временную папку.
# 2. Делает на сервере бэкап текущего корня сайта в ~/backups/t-invest.boxguide.ru/<дата-время>.
# 3. Выкладывает файлы сайта (страницы, стили, скрипты, картинки) в корень сайта.
#    Файлы перезаписываются, но ничего не удаляется: если файл убрали из репозитория,
#    на сервере его нужно удалить вручную.
# 4. Проверяет, что главная, оферта и политика открываются.
#
# Нужно: Git Bash (git, ssh, tar) и алиас «sprint» в ~/.ssh/config (вход по ключу).
set -euo pipefail

REPO="git@github-splin174:splin174/landing-tinvest-code.git"
BRANCH="main"
SSH_HOST="sprint"
SITE_ROOT="domains/t-invest.boxguide.ru/public_html"   # от домашней папки на сервере
BACKUP_DIR="backups/t-invest.boxguide.ru"
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
STAMP="$(date +%Y%m%d-%H%M%S)"
ssh "${SSH_OPTS[@]}" "$SSH_HOST" \
  "mkdir -p ~/$BACKUP_DIR/$STAMP && cp -a ~/$SITE_ROOT/. ~/$BACKUP_DIR/$STAMP/ && echo '    бэкап: ~/$BACKUP_DIR/$STAMP'"

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
