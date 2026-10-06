-- Orders schema
CREATE TABLE customers (id int primary key, name text);
CREATE TABLE orders (
  id int primary key,
  customer_id int REFERENCES customers(id),
  total numeric
);
CREATE VIEW order_totals AS
WITH recent AS (SELECT * FROM orders)
SELECT c.name, sum(r.total) FROM recent r JOIN customers c ON c.id = r.customer_id GROUP BY c.name;
INSERT INTO daily_revenue SELECT now(), sum(total) FROM orders;
