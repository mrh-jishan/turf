FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV NEXT_PUBLIC_API_BASE=http://api:8000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
