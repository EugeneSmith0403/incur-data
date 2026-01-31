#!/bin/bash

echo "🗄️  Выполнение миграций ClickHouse..."
echo "===================================="

CLICKHOUSE_URL=${CLICKHOUSE_URL:-http://localhost:8123}
DB=dln

# Создаем таблицу enriched_orders
echo "📦 Создание таблицы enriched_orders..."

curl -s "$CLICKHOUSE_URL" --data "
CREATE TABLE IF NOT EXISTS $DB.enriched_orders (
    signature String,
    slot UInt64,
    block_time DateTime64(3),
    program_id String,
    event_type String,
    order_id String,
    maker String,
    give_token_address String,
    give_amount String,
    take_token_address String,
    take_amount String,
    receiver_dst String,
    give_patch_authority_src String NULL,
    order_authority_address_dst String NULL,
    allowed_taker_dst String NULL,
    allowed_cancel_beneficiary_src String NULL,
    external_call String NULL,
    taker String NULL,
    unlock_authority String NULL,
    give_token_usd_price Nullable(Float64),
    take_token_usd_price Nullable(Float64),
    give_amount_usd Nullable(Float64),
    take_amount_usd Nullable(Float64),
    processed_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(processed_at)
PARTITION BY toYYYYMM(block_time)
ORDER BY (program_id, event_type, order_id, signature)
SETTINGS index_granularity = 8192;
"

echo "✅ Таблица enriched_orders создана"

echo ""
echo "✅ Миграции завершены!"
echo ""
echo "🔍 Проверка таблиц:"
curl -s "$CLICKHOUSE_URL/?query=SHOW%20TABLES%20FROM%20$DB"
