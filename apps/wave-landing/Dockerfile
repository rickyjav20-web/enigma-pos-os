FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

# Copy static files from wave-landing (paths relative to repo root)
COPY apps/wave-landing/index.html .
COPY apps/wave-landing/waitlist.html .
COPY apps/wave-landing/styles.css .
COPY apps/wave-landing/assets/ ./assets/

# Copy nginx config
COPY apps/wave-landing/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
