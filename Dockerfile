FROM php:8.1-apache
RUN apt-get update && apt-get install -y libcurl4-openssl-dev && docker-php-ext-install curl pdo pdo_mysql 2>/dev/null || true
COPY . /var/www/html/
RUN a2enmod rewrite && \
    sed -i 's/Listen 80/Listen 0.0.0.0:80/' /etc/apache2/ports.conf && \
    echo '<Directory /var/www/html>\n  Options Indexes FollowSymLinks\n  AllowOverride All\n  Require all granted\n</Directory>' > /etc/apache2/conf-available/docker.conf && \
    a2enconf docker && \
    chown -R www-data:www-data /var/www/html && \
    chmod -R 755 /var/www/html
EXPOSE 80
