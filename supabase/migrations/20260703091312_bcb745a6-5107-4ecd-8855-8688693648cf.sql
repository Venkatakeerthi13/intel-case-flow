-- ===== Agents (support team) =====
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Support Agent',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO anon, authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo access agents" ON public.agents FOR ALL USING (true) WITH CHECK (true);

-- ===== Accounts =====
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  phone text,
  website text,
  account_type text NOT NULL DEFAULT 'Customer',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO anon, authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo access accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);

-- ===== Contacts =====
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO anon, authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo access contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);

-- ===== Support Categories =====
CREATE TABLE public.support_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_priority text NOT NULL DEFAULT 'Medium',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_categories TO anon, authenticated;
GRANT ALL ON public.support_categories TO service_role;
ALTER TABLE public.support_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo access categories" ON public.support_categories FOR ALL USING (true) WITH CHECK (true);

-- ===== SLA Policies =====
CREATE TABLE public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name text NOT NULL,
  priority_level text NOT NULL UNIQUE,
  resolution_hours integer NOT NULL,
  escalation_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_policies TO anon, authenticated;
GRANT ALL ON public.sla_policies TO service_role;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo access sla" ON public.sla_policies FOR ALL USING (true) WITH CHECK (true);

-- ===== Cases =====
CREATE SEQUENCE public.case_number_seq START 1001;
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text UNIQUE,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'New',
  priority text,
  issue_type text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.support_categories(id) ON DELETE SET NULL,
  assigned_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  sla_due_date timestamptz,
  ai_suggested_response text,
  resolution_time_hours numeric,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO anon, authenticated;
GRANT ALL ON public.cases TO service_role;
GRANT USAGE ON SEQUENCE public.case_number_seq TO anon, authenticated, service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo access cases" ON public.cases FOR ALL USING (true) WITH CHECK (true);

-- ===== AI Feedback =====
CREATE SEQUENCE public.ai_feedback_seq START 1;
CREATE TABLE public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_number text UNIQUE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  feedback_status text NOT NULL DEFAULT 'Pending',
  ai_suggestion_type text,
  agent_comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_feedback TO anon, authenticated;
GRANT ALL ON public.ai_feedback TO service_role;
GRANT USAGE ON SEQUENCE public.ai_feedback_seq TO anon, authenticated, service_role;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public demo access ai_feedback" ON public.ai_feedback FOR ALL USING (true) WITH CHECK (true);

-- ===== Automation: case defaults (numbering, priority, SLA, assignment, closure) =====
CREATE OR REPLACE FUNCTION public.set_case_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hours integer;
BEGIN
  IF NEW.case_number IS NULL THEN
    NEW.case_number := 'CS-' || lpad(nextval('public.case_number_seq')::text, 5, '0');
  END IF;
  IF NEW.priority IS NULL AND NEW.category_id IS NOT NULL THEN
    SELECT default_priority INTO NEW.priority FROM public.support_categories WHERE id = NEW.category_id;
  END IF;
  NEW.priority := COALESCE(NEW.priority, 'Medium');
  SELECT resolution_hours INTO v_hours FROM public.sla_policies WHERE priority_level = NEW.priority;
  IF v_hours IS NOT NULL AND NEW.sla_due_date IS NULL THEN
    NEW.sla_due_date := COALESCE(NEW.created_at, now()) + make_interval(hours => v_hours);
  END IF;
  IF NEW.assigned_agent_id IS NULL THEN
    SELECT a.id INTO NEW.assigned_agent_id
    FROM public.agents a
    LEFT JOIN public.cases c ON c.assigned_agent_id = a.id AND c.status <> 'Closed'
    WHERE a.active AND a.role = 'Support Agent'
    GROUP BY a.id
    ORDER BY count(c.id) ASC, random()
    LIMIT 1;
  END IF;
  IF NEW.status = 'Closed' THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
    NEW.resolution_time_hours := round(EXTRACT(epoch FROM (NEW.closed_at - COALESCE(NEW.created_at, now()))) / 3600.0, 1);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_case_defaults BEFORE INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.set_case_defaults();

CREATE OR REPLACE FUNCTION public.handle_case_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hours integer;
BEGIN
  IF NEW.status = 'Closed' AND OLD.status <> 'Closed' THEN
    NEW.closed_at := now();
    NEW.resolution_time_hours := round(EXTRACT(epoch FROM (now() - NEW.created_at)) / 3600.0, 1);
  ELSIF NEW.status <> 'Closed' AND OLD.status = 'Closed' THEN
    NEW.closed_at := NULL;
    NEW.resolution_time_hours := NULL;
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    SELECT resolution_hours INTO v_hours FROM public.sla_policies WHERE priority_level = NEW.priority;
    IF v_hours IS NOT NULL THEN
      NEW.sla_due_date := NEW.created_at + make_interval(hours => v_hours);
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_case_update BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.handle_case_update();

CREATE OR REPLACE FUNCTION public.set_ai_feedback_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.feedback_number IS NULL THEN
    NEW.feedback_number := 'AIF-' || lpad(nextval('public.ai_feedback_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ai_feedback_number BEFORE INSERT ON public.ai_feedback
FOR EACH ROW EXECUTE FUNCTION public.set_ai_feedback_number();

-- ===== Seed data =====
INSERT INTO public.sla_policies (policy_name, priority_level, resolution_hours, escalation_required) VALUES
('Critical Response Policy', 'Critical', 4, true),
('High Priority Policy', 'High', 8, true),
('Standard Policy', 'Medium', 24, false),
('Low Priority Policy', 'Low', 72, false);

INSERT INTO public.support_categories (name, description, default_priority, active) VALUES
('Network & Connectivity', 'Outages, signal loss, tower issues and degraded coverage', 'Critical', true),
('Internet & Broadband', 'Fiber/DSL speed issues, router faults, intermittent drops', 'High', true),
('Billing & Payments', 'Invoice disputes, overcharges, payment failures, refunds', 'Medium', true),
('SIM & Activation', 'New SIM activation, eSIM transfer, porting requests', 'Medium', true),
('Roaming & International', 'International roaming activation and charge queries', 'Medium', true),
('Devices & Equipment', 'Handset, modem and set-top box troubleshooting', 'Low', true);

INSERT INTO public.agents (name, email, role, active) VALUES
('Alex Rivera', 'alex.rivera@telcosupport.com', 'Administrator', true),
('Priya Sharma', 'priya.sharma@telcosupport.com', 'Support Manager', true),
('Jordan Lee', 'jordan.lee@telcosupport.com', 'Support Agent', true),
('Maya Chen', 'maya.chen@telcosupport.com', 'Support Agent', true),
('Omar Haddad', 'omar.haddad@telcosupport.com', 'Support Agent', true),
('Sofia Reyes', 'sofia.reyes@telcosupport.com', 'Support Agent', true);

INSERT INTO public.accounts (name, industry, phone, website, account_type) VALUES
('Skyline Logistics', 'Transportation', '+1 415 555 0182', 'skylinelogistics.com', 'Customer'),
('BrightWave Media', 'Media & Entertainment', '+1 212 555 0147', 'brightwavemedia.com', 'Customer'),
('NorthPeak Manufacturing', 'Manufacturing', '+1 312 555 0126', 'northpeakmfg.com', 'Customer'),
('Cedar Grove Clinics', 'Healthcare', '+1 617 555 0193', 'cedargroveclinics.org', 'Customer'),
('Luma Retail Group', 'Retail', '+1 206 555 0158', 'lumaretail.com', 'Customer'),
('Harbor Financial', 'Financial Services', '+1 646 555 0171', 'harborfinancial.com', 'Customer');

INSERT INTO public.contacts (account_id, first_name, last_name, email, phone, title) VALUES
((SELECT id FROM public.accounts WHERE name='Skyline Logistics'), 'Daniel', 'Okafor', 'daniel.okafor@skylinelogistics.com', '+1 415 555 0201', 'IT Manager'),
((SELECT id FROM public.accounts WHERE name='Skyline Logistics'), 'Rachel', 'Kim', 'rachel.kim@skylinelogistics.com', '+1 415 555 0202', 'Operations Lead'),
((SELECT id FROM public.accounts WHERE name='BrightWave Media'), 'Marcus', 'Bell', 'marcus.bell@brightwavemedia.com', '+1 212 555 0203', 'Studio Engineer'),
((SELECT id FROM public.accounts WHERE name='BrightWave Media'), 'Elena', 'Vasquez', 'elena.vasquez@brightwavemedia.com', '+1 212 555 0204', 'Producer'),
((SELECT id FROM public.accounts WHERE name='NorthPeak Manufacturing'), 'Tom', 'Nguyen', 'tom.nguyen@northpeakmfg.com', '+1 312 555 0205', 'Plant Supervisor'),
((SELECT id FROM public.accounts WHERE name='Cedar Grove Clinics'), 'Aisha', 'Patel', 'aisha.patel@cedargroveclinics.org', '+1 617 555 0206', 'Practice Administrator'),
((SELECT id FROM public.accounts WHERE name='Cedar Grove Clinics'), 'Greg', 'Larson', 'greg.larson@cedargroveclinics.org', '+1 617 555 0207', 'IT Coordinator'),
((SELECT id FROM public.accounts WHERE name='Luma Retail Group'), 'Nina', 'Fischer', 'nina.fischer@lumaretail.com', '+1 206 555 0208', 'Store Systems Manager'),
((SELECT id FROM public.accounts WHERE name='Harbor Financial'), 'Victor', 'Adeyemi', 'victor.adeyemi@harborfinancial.com', '+1 646 555 0209', 'Infrastructure Lead'),
((SELECT id FROM public.accounts WHERE name='Harbor Financial'), 'Chloe', 'Martin', 'chloe.martin@harborfinancial.com', '+1 646 555 0210', 'Branch Manager');

-- Curated open cases
INSERT INTO public.cases (subject, description, issue_type, status, category_id, contact_id, account_id, created_at) VALUES
('Complete network outage at distribution hub', 'All 42 SIM-enabled fleet trackers at our Oakland distribution hub lost connectivity at 6:20 AM. GPS updates and driver comms are down. This is blocking dispatch operations.', 'Network Outage', 'New',
 (SELECT id FROM public.support_categories WHERE name='Network & Connectivity'),
 (SELECT id FROM public.contacts WHERE email='daniel.okafor@skylinelogistics.com'),
 (SELECT id FROM public.accounts WHERE name='Skyline Logistics'), now() - interval '3 hours'),
('Fiber link dropping every 20 minutes in studio B', 'Our dedicated 1Gbps fiber circuit drops for 30-60 seconds roughly every 20 minutes. Live broadcast uplinks are failing. Router logs show repeated PPPoE re-authentication.', 'Internet Speed', 'In Progress',
 (SELECT id FROM public.support_categories WHERE name='Internet & Broadband'),
 (SELECT id FROM public.contacts WHERE email='marcus.bell@brightwavemedia.com'),
 (SELECT id FROM public.accounts WHERE name='BrightWave Media'), now() - interval '9 hours'),
('Overcharged $2,340 on March invoice', 'Invoice #INV-88231 includes international roaming charges for 6 lines that never left the country. Requesting a full audit and credit for the disputed amount.', 'Billing Dispute', 'In Progress',
 (SELECT id FROM public.support_categories WHERE name='Billing & Payments'),
 (SELECT id FROM public.contacts WHERE email='aisha.patel@cedargroveclinics.org'),
 (SELECT id FROM public.accounts WHERE name='Cedar Grove Clinics'), now() - interval '26 hours'),
('eSIM transfer stuck for 15 new employee lines', 'We ordered 15 new eSIM activations for onboarding. QR codes were emailed but activation fails with error MM#2 on all devices. New hires start Monday.', 'SIM Activation', 'New',
 (SELECT id FROM public.support_categories WHERE name='SIM & Activation'),
 (SELECT id FROM public.contacts WHERE email='nina.fischer@lumaretail.com'),
 (SELECT id FROM public.accounts WHERE name='Luma Retail Group'), now() - interval '6 hours'),
('Roaming not working for executive traveling in Japan', 'Our CFO landed in Tokyo and has no data service despite the Global Roaming add-on being active on the account. Voice works intermittently.', 'Roaming Issue', 'Escalated',
 (SELECT id FROM public.support_categories WHERE name='Roaming & International'),
 (SELECT id FROM public.contacts WHERE email='victor.adeyemi@harborfinancial.com'),
 (SELECT id FROM public.accounts WHERE name='Harbor Financial'), now() - interval '14 hours'),
('Degraded 5G coverage on factory floor', 'Signal strength dropped from 4 bars to 1 bar across the assembly floor after last week. Handheld scanners keep losing connection to our WMS.', 'Network Outage', 'In Progress',
 (SELECT id FROM public.support_categories WHERE name='Network & Connectivity'),
 (SELECT id FROM public.contacts WHERE email='tom.nguyen@northpeakmfg.com'),
 (SELECT id FROM public.accounts WHERE name='NorthPeak Manufacturing'), now() - interval '2 days'),
('Replacement modem still not shipped', 'The replacement modem promised on our last call (case ref from two weeks ago) has not arrived. Branch office is running on a temporary hotspot.', 'Device Support', 'New',
 (SELECT id FROM public.support_categories WHERE name='Devices & Equipment'),
 (SELECT id FROM public.contacts WHERE email='chloe.martin@harborfinancial.com'),
 (SELECT id FROM public.accounts WHERE name='Harbor Financial'), now() - interval '30 hours'),
('Bulk plan upgrade quote for 120 lines', 'We want to move 120 lines from the Business Flex plan to Business Unlimited Pro. Need pricing, contract terms, and migration timeline.', 'Plan Change', 'New',
 (SELECT id FROM public.support_categories WHERE name='Billing & Payments'),
 (SELECT id FROM public.contacts WHERE email='rachel.kim@skylinelogistics.com'),
 (SELECT id FROM public.accounts WHERE name='Skyline Logistics'), now() - interval '1 day');

-- Historical closed cases for reports/trends (past ~6 months)
INSERT INTO public.cases (subject, description, issue_type, status, category_id, contact_id, account_id, created_at, closed_at)
SELECT
  (ARRAY[
    'Intermittent signal loss reported',
    'Slow broadband speeds during peak hours',
    'Invoice discrepancy on monthly statement',
    'SIM card not activating after porting',
    'Roaming charges query for overseas trip',
    'Router firmware causing disconnects',
    'Payment failed but amount debited',
    'Set-top box remote pairing failure',
    'VoIP call quality degradation',
    'Data plan overage alert not received'
  ])[1 + floor(random()*10)::int],
  'Historical case seeded for reporting and trend analysis.',
  (ARRAY['Network Outage','Internet Speed','Billing Dispute','SIM Activation','Roaming Issue','Device Support','Plan Change','Technical'])[1 + floor(random()*8)::int],
  'Closed',
  pick.cat_id, pick.contact_id, pick.account_id,
  s.created_at,
  s.created_at + s.res_interval
FROM (
  SELECT gs,
    now() - ((random()*175 + 2)::int * interval '1 day') - ((random()*10)::int * interval '1 hour') AS created_at,
    ((1 + (random()*60)::int) * interval '1 hour') AS res_interval
  FROM generate_series(1, 48) gs
) s
CROSS JOIN LATERAL (
  SELECT ct.id AS contact_id, ct.account_id, sc.id AS cat_id
  FROM public.contacts ct, public.support_categories sc
  WHERE s.gs IS NOT NULL
  ORDER BY random() LIMIT 1
) pick;

-- Sample AI feedback records
INSERT INTO public.ai_feedback (case_id, feedback_status, ai_suggestion_type, agent_comments)
SELECT id, 'Accepted', 'Customer Reply', 'AI draft was accurate; sent with minor greeting tweak.'
FROM public.cases WHERE status = 'In Progress' LIMIT 2;
INSERT INTO public.ai_feedback (case_id, feedback_status, ai_suggestion_type, agent_comments)
SELECT id, 'Modified', 'Troubleshooting Steps', 'Reordered steps to match our runbook before sending.'
FROM public.cases WHERE status = 'Escalated' LIMIT 1;