alter table public.projects add column if not exists project_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_project_url_web_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_project_url_web_check check (
        project_url is null
        or (project_url ~* '^https?://' and project_url !~ '://[^/]*@')
      );
  end if;
end;
$$;

insert into public.projects (
  title,
  slug,
  project_url,
  summary,
  description,
  stack,
  featured,
  published,
  sort_order
)
values
  (
    'Bus Tracking System - Cloud Deployment & Infrastructure',
    'bus-tracking-system-cloud-deployment',
    null,
    'Cloud deployment and infrastructure administration for a full-stack bus tracking application on an Oracle Cloud Linux VM.',
    'Deployed and administered a full-stack application on an Oracle Cloud Linux VM using SSH for remote server configuration, service management, API/database connectivity, firewall setup, and troubleshooting.',
    array['Oracle Cloud Infrastructure (OCI)', 'Linux', 'Full-Stack Application'],
    true,
    true,
    0
  ),
  (
    'ForexCompanion - AI-Powered Forex Co-Pilot',
    'forexcompanion-ai-powered-forex-co-pilot',
    'https://forexcompanion.trade',
    'An AI-assisted Forex co-pilot combining a 7-indicator consensus engine with an LLM explanation layer.',
    'Built and deployed an AI-assisted Forex trading co-pilot combining a 7-indicator consensus engine with an LLM explanation layer; managed live deployment, custom DNS, and HTTPS routing.',
    array['7-Indicator Consensus Engine', 'LLM Explanation Layer', 'DNS', 'HTTPS'],
    false,
    true,
    1
  ),
  (
    'Lead Craft AI - AI Web Application',
    'lead-craft-ai',
    'https://lead-craft-ai.vercel.app',
    'A cloud-hosted web application deployed on Vercel and integrated with GitHub CI/CD.',
    'Deployed and maintained a cloud-hosted web application on Vercel integrated with GitHub CI/CD pipelines for automated builds and zero-downtime releases.',
    array['Vercel', 'GitHub CI/CD'],
    false,
    true,
    2
  ),
  (
    'CareerBridge - Web Platform',
    'careerbridge-web-platform',
    'https://careerbridge.cyou',
    'A live web platform configured with custom-domain routing and cloud hosting.',
    'Configured custom domain routing, DNS management, SSL/HTTPS certificates, and cloud hosting infrastructure for a live web platform.',
    array['DNS Management', 'SSL/HTTPS', 'Cloud Hosting'],
    false,
    true,
    3
  ),
  (
    'Paw Favortees - Web Application',
    'paw-favortees-web-application',
    'https://paw-favortees.vercel.app',
    'A responsive web application developed and deployed using Git/GitHub workflows.',
    'Developed and deployed a responsive web application using Git/GitHub version control and automated cloud deployment workflows.',
    array['Git', 'GitHub', 'Cloud Deployment'],
    false,
    true,
    4
  ),
  (
    'Personal Developer Portfolio',
    'personal-developer-portfolio',
    'https://sohaib-ahmed-five.vercel.app',
    'A personal portfolio presenting DevOps infrastructure projects and web deployments.',
    'Designed, built, and deployed a personal portfolio website showcasing DevOps infrastructure projects, web deployments, and professional profiles.',
    array['Git', 'GitHub', 'Cloud Deployment'],
    false,
    true,
    5
  )
on conflict (slug) do nothing;

update public.site_settings
set social_links = social_links || jsonb_build_array(jsonb_build_object(
  'label', 'LinkedIn',
  'url', 'https://linkedin.com/in/sohaib-ahmed-gondal-517a98225'
))
where id = 1
  and jsonb_array_length(social_links) < 8
  and not exists (
    select 1 from jsonb_array_elements(social_links) as item(link)
    where lower(link ->> 'label') = 'linkedin'
      or link ->> 'url' = 'https://linkedin.com/in/sohaib-ahmed-gondal-517a98225'
  );

update public.site_settings
set social_links = social_links || jsonb_build_array(jsonb_build_object(
  'label', 'GitHub',
  'url', 'https://github.com/asifgondal786'
))
where id = 1
  and jsonb_array_length(social_links) < 8
  and not exists (
    select 1 from jsonb_array_elements(social_links) as item(link)
    where lower(link ->> 'label') = 'github'
      or link ->> 'url' = 'https://github.com/asifgondal786'
  );

update public.site_settings
set social_links = social_links || jsonb_build_array(jsonb_build_object(
  'label', 'X',
  'url', 'https://x.com/commando_7jp91'
))
where id = 1
  and jsonb_array_length(social_links) < 8
  and not exists (
    select 1 from jsonb_array_elements(social_links) as item(link)
    where lower(link ->> 'label') = 'x'
      or link ->> 'url' = 'https://x.com/commando_7jp91'
  );
