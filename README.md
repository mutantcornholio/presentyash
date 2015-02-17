# presentyash
A nice presentation viewer

Working demo is here: http://presentyash.mcornholio.ru (if it is not working, tell me)

<h4>Features</h4>
This project a test case for my job application. <br>
It's a web interface to show presentations.<br>
You can run several presentations simultaneously, easily switching between them. <br>
You can control your presentations remotely, over the web from other device (like a second laptop, or mobile phone).<br>
Presentyash preloads all your images when you open presentation interface. <br>

<h4>Installation</h4>
Presentyash should run on every computer with npm installed:
```
git clone https://github.com/mutantcornholio/presentyash.git
npm install
```
<h4>Run Presentyash</h4>
```
cd presentyash
node app.js
```

now go to http://127.0.0.1:3000

<h4>Adding you own presentations</h4>
To add your own presentations, create a directory in _presentations_, place your images there and run following script (requires imagemagick):
```
mkdir 1024x768
mkdir 800x600
mkdir 400x300
mkdir 200x150

for i in $( ls *.jpg); 
	do 
		convert -resize 1024x768 $i 1024x768/$i && 
		convert -resize 800x600 $i 800x600/$i && 
		convert -resize 400x300 $i 400x300/$i && 
		convert -resize 200x150 $i 200x150/$i &&; 
	done
```
It will create thumbnails for you images.
Then, restart Presentyash. 

<h4>Run Presentyash behind nginx</h4>
Add this to your http part of nginx.conf
```
server {
		server_name presentyash.example.com;  # replace this by your host name
		location / {
			proxy_pass http://127.0.0.1:3000;
			proxy_http_version 1.1;
			proxy_set_header Upgrade $http_upgrade;
			proxy_set_header Connection "upgrade";

		}
	}
```	
<h4>What's inside</h4>
Server side is on <a href="http://expressjs.com/">express.js</a> with <a href="https://github.com/adammark/Markup.js/">markup.js</a> for templating.<br>
Presentyash use same templates on client and server. <br>
Remote control is achived by using <a href="http://socket.io/">socket.io</a> to communicate between server and clients.<br>
All static files are sending by node.js for the sake of simplicity; you do not need http server to run this.<br>

Got questions? Ask!
