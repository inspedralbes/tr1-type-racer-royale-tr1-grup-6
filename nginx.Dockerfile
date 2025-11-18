# nginx.Dockerfile
# Este Dockerfile configura la imagen de Nginx para producción.
# Utiliza una construcción multi-etapa para optimizar el tamaño de la imagen final.

# Etapa 1: Construir la aplicación Vue para producción
FROM node:20-alpine AS frontend-builder

# Establecer el directorio de trabajo para la construcción del frontend
WORKDIR /app

# Copiar los ficheros de dependencias del frontend
COPY front/typeracer/package*.json ./

# Instalar las dependencias del frontend
RUN npm install

# Copiar el resto del código fuente del frontend
COPY front/typeracer/ /app/

# Construir la aplicación Vue para producción
RUN npm run build

# Etapa final: Configurar Nginx
FROM nginx:stable-alpine

# Copia la configuración de Nginx que define cómo se sirve el contenido.
# Este fichero se encuentra en la raíz del proyecto.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia los ficheros estáticos del frontend (HTML, CSS, JS) desde la etapa de construcción
# del frontend (definida como 'frontend-builder' arriba).
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Expone el puerto 80 para el tráfico HTTP.
EXPOSE 80

# Comando para iniciar Nginx en primer plano.
CMD ["nginx", "-g", "daemon off;"]