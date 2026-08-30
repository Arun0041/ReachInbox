# Use Node.js 20 Alpine for a lightweight image
FROM node:20-alpine

WORKDIR /app

# Copy the root package files
COPY package*.json ./

# Copy the workspace package files so npm installs properly
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies (required because the backend uses 'tsx' which is in devDependencies)
RUN npm install

# Copy the backend source code
COPY backend/ ./backend/

# Expose the API port
EXPOSE 5000

# Start the server using the workspace command
CMD ["npm", "--workspace", "backend", "run", "start"]
