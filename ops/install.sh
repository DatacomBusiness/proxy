#!/bin/bash

<<comment 

HOW TO USE THIS FILE. 
nano this file (install.sh) in the users home directory. Execute (source install.sh) as sudo and enter sudo password.
Make sure you are the owner of this file
Errors and report logs will be in the LOGFILE listed below.
We will take care fo the rest. :)

comment

	#Specify Logfile
	LOGFILE=/$USER/install.log

# Stop this script on any error.
set -e

function setup {
	echo "********************** $(date "+%m%d%Y %T") : Starting Install script **********************"

	# Instal Openresty and dependencies
	# apt-get -y install --no-install-recommends wget gnupg ca-certificates gnupg1 gnupg2
	# wget -O - https://openresty.org/package/pubkey.gpg | sudo gpg --yes --dearmor -o /usr/share/keyrings/openresty.gpg
	# echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/openresty.gpg] http://openresty.org/package/ubuntu $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/openresty.list > /dev/null
	# sudo apt-get update
	# sudo apt-get -y install openresty

	# # Install Dependencies
	# apt-get update
	# apt install libpam0g-dev build-essential redis-server luarocks --no-install-recommends wget gnupg ca-certificates curl git fail2ban -y

	# # Install Node
	# curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
	# sudo apt-get install -y nodejs

	# echo "deb http://openresty.org/package/ubuntu $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/openresty.list
			
	# wget -O - https://openresty.org/package/pubkey.gpg | sudo apt-key add -

	# sudo apt-get -y install openresty

	# sudo luarocks install lua-resty-auto-ssl
	# sudo luarocks install lua-resty-socket
	# sudo luarocks install luasocket
	# sudo luarocks install luasocket-unix
	# sudo luarocks install lua-cjson

	# echo "********************** Installed all software **********************"

	# if [ -d /var/www/ ]; then
	# 	rm -r /var/www/
	# fi
	# # mkdir's
	# if [ ! -d /etc/ssl ]; then
	# 	mkdir /etc/ssl/
	# fi
	# if [ ! -d /var/log/nginx ]; then
	# 	mkdir /var/log/nginx
	# fi
	# if [ ! -d /var/log/crontab ]; then
	# 	mkdir /var/log/crontab
	# fi
	# if [ ! -d /var/www ]; then
	# 	mkdir /var/www
	# fi
	# if [ ! -d /var/log/fail2ban]; then
	# 	mkdir /var/log/fail2ban
	# fi
	# if [ ! -d /etc/openresty/sites-enabled/ ]; then
	# 	mkdir /etc/openresty/sites-enabled/
	# fi

	# chmod -R 777 /var/log
	# chmod -R 777 /var/www
	# chmod -R 777 /etc/ssl

	# openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt
	# openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509   -subj '/CN=sni-support-required-for-valid-ssl'   -keyout /etc/ssl/resty-auto-ssl-fallback.key   -out /etc/ssl/resty-auto-ssl-fallback.crt

	# Setup git repo
	cd /var/www
	git clone --branch ian https://github.com/DatacomBusiness/proxy.git
	# Used for replacing tempalte tags in settings files

	# Enter dir
	echo $PWD
	cd ./proxy
	echo $PWD

	# source ~/secrets.sh
	source ./ops/vars/variables.sh
	## Pull in the mustache template library for bash
	source ./ops/lib/mo
	sudo echo '2) Loaded mo'

	# # Install repo modules
	# npm install ./nodejs
	# echo "********************** Cloned and installed Repo and Node **********************"
	
	# #Set Nginx Files for hosting
	# nginx_conf="$(cat ./ops/nginx/nginx.conf)"
	# sudo echo "$nginx_conf" | mo > /etc/openresty/nginx.conf
	# autossl_conf="$(cat ./ops/nginx/autossl.conf)"
	# sudo echo "$autossl_conf" | mo > /etc/openresty/autossl.conf 
	# proxy_conf="$(cat ./ops/nginx/000-proxy.conf)"
	# sudo echo "$proxy_conf" | mo > /etc/openresty/sites-enabled/000-${SITE_NAME}.conf

	# #Systemd Node Process
	# systemd_conf="$(cat ./ops/systemd/proxy.service)"
	# sudo echo "$systemd_conf" | mo > /etc/systemd/system/${SITE_NAME}.service
	
	# systemctl start ${SITE_NAME}.service
	# systemctl enable ${SITE_NAME}.service

	# echo '********************** nginx setup completed **********************'

	#Modify Nginx files with fail2ban settings
	sed -i -e '/http {/r ./ops/fail2ban/nginx-insert.conf' ./ops/nginx/nginx.conf
	# sed '/pattern/a some text here' filename
	sed -i -e '/location / {/r ./ops/fail2ban/000-proxy-insert.conf' ./ops/nginx/000-${SITE_NAME}.conf

	# fil2ban filter
	filter="$(cat ./ops/fail2ban/nginx-req-limit)"
	sudo echo "$filter" | mo > /etc/fail2ban/filter.d/nginx-req-limit

	cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
	jail_local="$(cat ./ops/fail2ban/jail.conf)"
	sudo echo "$jail_local" | mo >> /etc/fail2ban/jail.local

	service fail2ban restart
	fail2ban-client -d

	echo "********************** Installed Fail2ban **********************"

	#Set up Crontab for restarting and logging
	
	crontab="$(cat ./ops/fail2ban/jail.conf)"
	sudo echo "$crontab" | mo >> /etc/fail2ban/jail.local
	(crontab -l 2>/dev/null; "echo $crontab")| crontab -

	echo "********************** Installed Crontab **********************"
			
	echo "$(date "+%m%d%Y %T") : Script completed"
	
}

## call function and append to log
setup 2>&1 > ${LOGFILE}

