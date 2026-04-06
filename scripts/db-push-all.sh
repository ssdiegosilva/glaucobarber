#!/bin/bash
# Roda prisma db push nos dois bancos: staging e prod
# Uso: ./scripts/db-push-all.sh

export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"

STAGING_DATABASE_URL="postgresql://postgres.vwcjnipxvxfusutaskby:khk4jRQ4kfnJWmUX@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
STAGING_DIRECT_URL="postgresql://postgres:khk4jRQ4kfnJWmUX@db.vwcjnipxvxfusutaskby.supabase.co:5432/postgres"

PROD_DATABASE_URL="postgresql://postgres.anntggtuaqgrxnokwfm:Th4XaBkK7onKB4QM@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
PROD_DIRECT_URL="postgresql://postgres:Th4XaBkK7onKB4QM@db.lanntggtuaqgrxnokwfm.supabase.co:5432/postgres"

echo "🔵 Rodando prisma db push em STAGING..."
DATABASE_URL="$STAGING_DATABASE_URL" DIRECT_URL="$STAGING_DIRECT_URL" npx prisma db push
if [ $? -ne 0 ]; then
  echo "❌ Falhou em STAGING. Abortando (prod não foi tocado)."
  exit 1
fi
echo "✅ STAGING ok"

echo ""
echo "🔴 Rodando prisma db push em PROD..."
DATABASE_URL="$PROD_DATABASE_URL" DIRECT_URL="$PROD_DIRECT_URL" npx prisma db push
if [ $? -ne 0 ]; then
  echo "❌ Falhou em PROD."
  exit 1
fi
echo "✅ PROD ok"
