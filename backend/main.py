from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

# Lugar de los archivos estáticos
app.mount("/static",
          StaticFiles(directory="static"), 
          name="static")

# Configuracion de Jinja2
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    # Renderizar index.html pasando la petición
    return templates.TemplateResponse("index.html",
                                      {"request": request})