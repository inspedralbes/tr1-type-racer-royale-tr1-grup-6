# nginx.Dockerfile
# Este Dockerfile configura la imagen de Nginx para producción.
# Utiliza una construcción multi-etapa para optimizar el tamaño de la imagen final.

# La primera etapa (frontend-builder) ya se ha definido en docker-compose.prod.yml
# y se utiliza aquí para copiar los artefactos de construcción del frontend.
# No es necesario volver a construir el frontend aquí.

# Etapa final: Configurar Nginx
FROM nginx:stable-alpine

# Copia la configuración de Nginx que define cómo se sirve el contenido.
# Este fichero se encuentra en la raíz del proyecto.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia los ficheros estáticos del frontend (HTML, CSS, JS) desde la etapa de construcción
# del frontend (definida como 'frontend' en docker-compose.prod.yml).
# El nombre 'frontend' debe coincidir con el nombre del servicio en docker-compose.prod.yml.
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Expone el puerto 80 para el tráfico HTTP.
EXPOSE 80

# Comando para iniciar Nginx en primer plano.
CMD ["nginx", "-g", "daemon off;"]