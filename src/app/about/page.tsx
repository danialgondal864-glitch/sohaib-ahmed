import { profile } from "@/lib/data";

export default function About() {
  return (
    <div className="page-shell container">
      <div className="page-intro">
        <p className="eyebrow">ABOUT ME</p>
        <h1>Curiosity drives.<br /><span className="gradient-text">Systems inspire.</span></h1>
        <p>{profile.summary} {profile.careerObjective}</p>
      </div>

      <div className="two-col">
        <section className="panel">
          <p className="eyebrow">MY DIRECTION</p>
          <h2>Career objective</h2>
          <p>{profile.careerObjective}</p>
        </section>
        <section className="panel">
          <p className="eyebrow">EDUCATION</p>
          <h2>Academic background</h2>
          {profile.education.map((education) => (
            <div className="timeline-item" key={education.degree}>
              <span className="timeline-date">{education.years}</span>
              <h3>{education.degree}</h3>
              <p>{education.school}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="section-inner">
        <p className="eyebrow">EXPERIENCE</p>
        <h2>Professional experience</h2>
        {profile.experience.map((experience) => (
          <article className="panel timeline-item" key={`${experience.company}-${experience.role}`}>
            <span className="timeline-date">{experience.period}</span>
            <h3>{experience.role} — {experience.company}</h3>
            <p>{experience.location}</p>
            <ul>
              {experience.responsibilities.map((responsibility) => (
                <li key={responsibility}>{responsibility}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="section-inner">
        <p className="eyebrow">TECHNICAL TOOLKIT</p>
        <h2>Skills & technologies</h2>
        <div className="skill-grid">
          {profile.skills.map((skill) => (
            <div className="skill-card" key={skill.group}>
              <h3>{skill.group}</h3>
              <div className="tag-row">
                {skill.items.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">TRAINING & COURSEWORK</p>
        <h2>Learning in progress</h2>
        <div className="tag-row">
          {profile.training.map((training) => <span key={training}>{training}</span>)}
        </div>
        <p className="fine-print">Course status is shown as stated in the supplied CV; no additional certifications are implied.</p>
      </section>
    </div>
  );
}
