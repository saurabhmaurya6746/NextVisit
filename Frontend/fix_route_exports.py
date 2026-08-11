import os
import re

routes_dir = r"c:\Users\hp\Desktop\Major Project\Ireland master plan\Nextvisit\Frontend\src\routes"

for filename in os.listdir(routes_dir):
    if not filename.endswith(".tsx") or filename in ["__root.tsx", "admin.tsx", "app.$type.$business.tsx", "app.index.tsx"]:
        continue

    filepath = os.path.join(routes_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Check if export default is already present
    if "export default" in content:
        continue

    # Find main function name
    # e.g., function Index() -> export default function Index()
    # or export function AdminDashboardView() -> export default function AdminDashboardView()
    funcs = re.findall(r'function\s+([A-Za-z0-9_]+)\s*\(', content)
    if funcs:
        main_func = funcs[0]
        # Replace 'function MainFunc' with 'export default function MainFunc'
        # Or if 'export function MainFunc', replace with 'export default function MainFunc'
        content = re.sub(rf'export\s+function\s+{main_func}', f'export default function {main_func}', content)
        if f'export default function {main_func}' not in content:
            content = re.sub(rf'function\s+{main_func}', f'export default function {main_func}', content, count=1)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Added default export to {filename} ({main_func})")
