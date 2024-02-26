import http from 'http';
import App from './App.js';
 
const port = process.env.PORT || 5002;

// Create the server 
const server = http.createServer(App);

// Listen 
server.listen(port, () => {
    console.log(`App started on port ${port}`);
});
