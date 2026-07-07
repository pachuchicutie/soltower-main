grant usage on schema private to service_role;
grant all privileges on all tables in schema private to service_role;
grant all privileges on all sequences in schema private to service_role;
grant execute on all functions in schema private to service_role;

alter default privileges in schema private grant all privileges on tables to service_role;
alter default privileges in schema private grant all privileges on sequences to service_role;
alter default privileges in schema private grant execute on functions to service_role;
