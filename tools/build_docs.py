"""Собирает oferta.html и privacy.html из docs-src/oferta-text.md и docs-src/privacy-text.md.

Запуск из корня проекта:  python tools/build_docs.py

Что делает:
- переносит текст дословно: «# » — заголовок документа, «## » — раздел,
  «1.1. …» — пункт, несколько строк подряд — блок реквизитов;
- ставит неразрывные пробелы после коротких слов, перед тире, в числах и «ст. 435»;
- подсвечивает жёлтым места в [квадратных скобках] и адрес сайта SITE;
- берёт подвал из index.html, чтобы он совпадал с главной.
Нужен только Python 3, сторонние библиотеки не используются.
"""
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = 'docs-src'  # папка с текстами документов

# Адрес сайта в тексте документов: становится ссылкой и подсвечивается как отложенное поле.
# После переезда на новый домен поменяйте его здесь и в .md-файлах.
SITE = 'https://splin174.github.io/landing-tinvest-code/'

SHORT_WORD = re.compile(r'(^|[\s(« ])([А-Яа-яЁё]{1,3})[ ](?=\S)')
FILL_OPEN, FILL_CLOSE = '', ''


def mark_brackets(s):
    """Оборачивает [места для заполнения] в маркеры, вложенные скобки — в один блок."""
    out, depth, buf = [], 0, ''
    for ch in s:
        if ch == '[':
            if depth == 0:
                out.append(buf)
                buf = ''
            depth += 1
            buf += ch
        elif ch == ']' and depth:
            depth -= 1
            buf += ch
            if depth == 0:
                out.append(FILL_OPEN + buf + FILL_CLOSE)
                buf = ''
        else:
            buf += ch
    out.append(buf)
    return ''.join(out)


def typo(s):
    s = html.escape(s, quote=False)
    s = mark_brackets(s)
    prev = None
    while prev != s:  # цепочки вроде «и в» — по одному слову за проход
        prev = s
        s = SHORT_WORD.sub(lambda m: m.group(1) + m.group(2) + ' ', s)
    s = s.replace(' — ', ' — ')
    s = re.sub(r'(\d) (?=\d|\(|рубл|дн|лет|час|календ|рабоч|минут|секунд)', lambda m: m.group(1) + ' ', s)
    s = re.sub(r'(№|ст\.|п\.|ч\.) (?=\d)', lambda m: m.group(1) + ' ', s)
    s = s.replace(SITE, '<mark class="doc__fill"><a href="index.html">' + SITE + '</a></mark>')
    s = re.sub(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', lambda m: '<a href="mailto:' + m.group(0) + '">' + m.group(0) + '</a>', s)
    # Ссылка на политику из оферты открывается во всплывающем окне (data-doc)
    s = s.replace('(privacy.html)', '(<a href="privacy.html" data-doc>privacy.html</a>)')
    s = s.replace(FILL_OPEN, '<mark class="doc__fill">').replace(FILL_CLOSE, '</mark>')
    return s.replace(' ', '&nbsp;')


def read(name):
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        sys.exit(f'Нет файла {name}')
    with open(path, encoding='utf-8') as f:
        return f.read()


def body(md):
    lines = [l.rstrip() for l in read(md).split('\n')]
    title = lines[0].lstrip('# ').strip()
    # Абзацы — группы непустых строк
    paras, block = [], []
    for line in lines[1:] + ['']:
        if line.strip():
            block.append(line)
        elif block:
            paras.append(block)
            block = []
    parts, in_section = [], False
    for b in paras:
        first = b[0]
        if first.startswith('## '):
            if in_section:
                parts.append('      </section>')
            parts.append('      <section class="doc__section">')
            parts.append('        <h2 class="doc__h2">' + typo(first[3:]) + '</h2>')
            in_section = True
        elif first.startswith('Редакция от'):
            parts.append('      <p class="doc__date">' + typo(first) + '</p>')
        elif len(b) > 1:
            parts.append('        <p class="doc__requisites">' + '<br>\n          '.join(typo(x) for x in b) + '</p>')
        else:
            m = re.match(r'^(\d+\.\d+\.)\s+(.*)$', first)
            if m:
                parts.append('        <p class="doc__item"><span class="doc__num">' + m.group(1) + '</span> ' + typo(m.group(2)) + '</p>')
            else:
                parts.append('        <p class="doc__item doc__item--note">' + typo(first) + '</p>')
    if in_section:
        parts.append('      </section>')
    return title, '\n'.join(parts)


HEADER = '''  <header class="header" id="top">
    <div class="container header__inner">
      <a class="logo" href="index.html" aria-label="На главную">
        <img class="logo__img" src="images/logo.webp" alt="Логотип: Т-Инвест, Python, Google Таблица и Telegram" width="56" height="56">
      </a>
      <p class="header__title">Все активы Т&#8209;Инвестиций в&nbsp;одной Google Таблице</p>
    </div>
  </header>'''


def footer():
    m = re.search(r'  <footer class="footer">.*?</footer>', read('index.html'), re.S)
    if not m:
        sys.exit('В index.html не найден <footer class="footer">')
    return m.group(0)


def page(md, out, page_title, desc):
    title, content = body(md)
    doc = f'''<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{page_title}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#0B1F3A">
  <link rel="icon" type="image/png" href="images/favicon.png">
  <link rel="stylesheet" href="styles.css">
  <script>document.documentElement.classList.add('js');</script>
</head>
<body>
{HEADER}

  <main class="doc">
    <div class="container doc__inner">
      <a class="doc__back" href="index.html">← Вернуться на&nbsp;главную</a>
      <h1 class="doc__title">{typo(title)}</h1>
{content}
      <a class="doc__back doc__back--bottom" href="index.html">← Вернуться на&nbsp;главную</a>
    </div>
  </main>

{footer()}

  <script src="script.js" defer></script>
</body>
</html>
'''
    with open(os.path.join(ROOT, out), 'w', encoding='utf-8', newline='\n') as f:
        f.write(doc)
    fills = doc.count('<mark class="doc__fill">')
    print(f'{out}: готово, мест для заполнения (жёлтых) — {fills}')


if __name__ == '__main__':
    page(os.path.join(SRC, 'oferta-text.md'), 'oferta.html',
         'Публичная оферта — Т-Инвест: все портфели в Google Таблице и Telegram-боте',
         'Публичная оферта ИП Куликова В.С. на предоставление доступа к цифровому продукту «Автоматизация сбора данных из Т-Инвест: все портфели в Google Таблице и Telegram-боте».')
    page(os.path.join(SRC, 'privacy-text.md'), 'privacy.html',
         'Политика конфиденциальности — Т-Инвест: все портфели в Google Таблице и Telegram-боте',
         'Политика конфиденциальности и обработки персональных данных ИП Куликова В.С.: какие данные обрабатываются при покупке продукта и обращении в поддержку.')
