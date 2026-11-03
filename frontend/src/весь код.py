import os

# Папки, которые нужно полностью пропустить (бинарники, библиотеки, кэш)
EXCLUDE_DIRS = {
    'node_modules', '.git', 'venv', '.venv', 'env', 
    'target', '__pycache__', 'dist', 'build', '.idea', 
    '.vscode', 'LPN_Analyzer.egg-info'
}

# Расширения файлов исходного кода, которые нужно объединить
INCLUDE_EXTENSIONS = {
    '.rs', '.toml',
    '.ts', '.tsx', '.js', '.jsx', 
    '.html', '.css'
}

OUTPUT_FILE = "source_code_dump.txt"

def make_code_dump(root_dir):
    total_files = 0
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
        outfile.write("===================================================\n")
        outfile.write("        ПОЛНЫЙ ДАМП ИСХОДНОГО КОДА ПРОЕКТА LPN     \n")
        outfile.write("===================================================\n\n")
        
        for root, dirs, files in os.walk(root_dir):
            # Исключаем служебные папки «на лету»
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                
                # Проверяем расширение файла
                if ext in INCLUDE_EXTENSIONS:
                    file_path = os.path.join(root, f)
                    relative_path = os.path.relpath(file_path, root_dir)
                    
                    # Пропускаем сам этот скрипт дампа, чтобы он не копировал себя
                    if f == "dump_code.py" or relative_path == OUTPUT_FILE:
                        continue
                        
                    total_files += 1
                    
                    # Пишем красивый разделитель для каждого файла
                    outfile.write(f"// ==================================================\n")
                    outfile.write(f"// ФАЙЛ: {relative_path}\n")
                    outfile.write(f"// ==================================================\n\n")
                    
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as infile:
                            outfile.write(infile.read())
                    except Exception as e:
                        outfile.write(f"[ОШИБКА ЧТЕНИЯ ФАЙЛА: {str(e)}]\n")
                        
                    outfile.write("\n\n")
                    
    print(f" Успешно! Весь код из {total_files} файлов сохранен в: {os.path.abspath(OUTPUT_FILE)}")

if __name__ == "__main__":
    make_code_dump(".")
