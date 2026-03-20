FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose Vite's default port
EXPOSE 5173

# Run the dev server and expose to network
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
