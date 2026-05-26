# 1. Descargar imagen de python ligera
FROM python:3.11-slim

# 2. Crea una carpeta llamada /app dentro del contenedor para trabajar ahí
WORKDIR /app

# 3. Copiar el archivo requirements.txt de tu laptop hacia la carpeta /app del contenedor
COPY requirements.txt .

# 4. Instalar librerias dentro del contenedor
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copia el resto de archivos al contenedor
COPY . .

# 6. Exponer el puerto 8000
EXPOSE 8000

# 7. Comando por defecto al iniciar el contenerdor
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
