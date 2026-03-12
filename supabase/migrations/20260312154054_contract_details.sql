-- Add detailed fields and cancellation flow to contracts
ALTER TABLE public.contracts
ADD COLUMN contact_person text,
ADD COLUMN payment_terms text,
ADD COLUMN scope_of_services text,
ADD COLUMN special_agreements text,
ADD COLUMN cancellation_date date,
ADD COLUMN cancellation_document_url text;

-- Add default fields to contract_templates
ALTER TABLE public.contract_templates
ADD COLUMN default_payment_terms text,
ADD COLUMN default_scope_of_services text,
ADD COLUMN default_special_agreements text;
