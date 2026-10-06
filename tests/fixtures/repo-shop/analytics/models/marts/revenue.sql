select * from {{ ref('stg_orders') }} join {{ source('shop', 'customers') }} using (customer_id)
