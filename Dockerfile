FROM php:8.1-apache
COPY . /var/www/html/
RUN a2enmod rewrite && \
    sed -i 's/Listen 80/Listen 0.0.0.0:80/' /etc/apache2/ports.conf && \
    echo '<Directory /var/www/html>\n  Options Indexes FollowSymLinks\n  AllowOverride All\n  Require all granted\n</Directory>' > /etc/apache2/conf-available/docker.conf && \
    a2enconf docker
RUN docker-php-ext-install pdo pdo_mysql 2>/dev/null || true
EXPOSE 80
