import json

with open('products.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

with open('data.js', 'w', encoding='utf-8') as f:
    f.write('const products =\n    ')
    f.write(json.dumps(d, ensure_ascii=False, indent=4))
    f.write('\n')

print('data.js escrito:', len(d), 'productos')
