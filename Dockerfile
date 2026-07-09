# RescueFlow 多阶段构建:前端构建 + 后端运行
# 群众端 H5、管理后台静态文件由后端提供;MongoDB/AI/地图通过环境变量接入。

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY vue-h5/package.json ./vue-h5/
COPY vue-admin/package.json ./vue-admin/
RUN npm install --cache /tmp/npm --omit=dev --workspace=shared --workspace=server
RUN npm install --cache /tmp/npm --workspace=vue-h5 --workspace=vue-admin

COPY . .
RUN npm -w vue-h5 run build && npm -w vue-admin run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/vue-h5/dist ./public/h5
COPY --from=builder /app/vue-admin/dist ./public/admin

# 让后端托管前端静态文件
ENV STATIC_H5_DIR=/app/public/h5
ENV STATIC_ADMIN_DIR=/app/public/admin
ENV UPLOAD_DIR=/app/uploads

EXPOSE 3000
CMD ["node", "server/src/app.js"]
