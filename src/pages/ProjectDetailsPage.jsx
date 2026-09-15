import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
} from "lucide-react";
import { useToast } from "../components/ToastContext.jsx";

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const demoStudentId = "507f1f77bcf86cd799439011";

  useEffect(() => {
  const start = Date.now();

  fetch(`http://127.0.0.1:8787/api/product-requests/${id}`)
    .then((res) => res.json())
    .then((data) => {
      const elapsed = Date.now() - start;
      const delay = Math.max(500 - elapsed, 0);

      setTimeout(() => {
        setProject(data);
        setLoading(false);
      }, delay);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
}, [id]);

async function handleApply() {


  try {
    setApplying(true);

    const response = await fetch(
      `http://127.0.0.1:8787/api/product-requests/${id}/assign`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
       body: JSON.stringify({
  studentId: demoStudentId,
}),
      }
    );

    const updatedProject = await response.json();

   if (response.ok) {
  setProject(updatedProject);
  toast("Application submitted successfully.");
} else {
      console.error(updatedProject);
    }
  } catch (error) {
    console.error(error);
  } finally {
    setApplying(false);
  }
}
const hasApplied =
  project?.assignedStudents?.some(
    (student) => (student._id || student) === demoStudentId
  ) || false;

const deadlinePassed =
  project?.deadline && new Date(project.deadline) < new Date();

 if (loading) {
  return (
    <main className="product-page loading-page">
      <div className="morrow-loader"></div>
      <p className="loading-text">Loading project...</p>
    </main>
  );
}

  if (!project) {
    return (
      <main className="product-page">
        <p>Project not found.</p>
      </main>
    );
  }

  return (
    <main className="product-page">
      <section className="project-hero">
        <div className="page-container">
          <Link to="/projects" className="text-action back-link">
            <ArrowLeft size={16} />
            Back to Projects
          </Link>

          <p className="eyebrow">{project.companyName}</p>
          <h1>{project.title}</h1>

          <div className="project-row__meta hero-meta">
            <span>
              <BriefcaseBusiness size={15} />
              {project.department}
            </span>

            <span>
              <Clock3 size={15} />
              {project.category}
            </span>

            <span>
              <CalendarDays size={15} />
              {project.deadline
                ? new Date(project.deadline).toLocaleDateString()
                : "No deadline"}
            </span>
          </div>
        </div>
      </section>

      <section className="page-container project-detail-section">
        <div className="project-detail-card">
          <h2>Project Overview</h2>

          <p className="project-description">{project.description}</p>

         <hr className="project-divider" />

<div className="project-info-grid">
  <div className="info-card">
    <span className="deadline-label">Application deadline</span>
    <strong>
      {project.deadline
        ? new Date(project.deadline).toLocaleDateString()
        : "No deadline"}
    </strong>
  </div>

  <div className="info-card">
    <span className="deadline-label">Applicants</span>
    <strong>
      {project.assignedStudents?.length || 0}
    </strong>
  </div>
</div>

<div className="applications-panel">
  <div className="applications-panel__header">
    <div>
      <h3>Applications</h3>
      <p>
        {project.assignedStudents?.length || 0} student
        {(project.assignedStudents?.length || 0) !== 1 ? "s" : ""} applied
      </p>
    </div>
  </div>

  {project.assignedStudents?.length > 0 ? (
    <div className="applicant-list">
      {project.assignedStudents.map((student, index) => (
        <div className="applicant-row" key={student._id || student}>
          <div className="applicant-avatar">
            {student.name
              ? student.name.charAt(0).toUpperCase()
              : index + 1}
          </div>

          <div className="applicant-info">
            <strong>{student.name || "Applicant"}</strong>
            <span>{student.email || "Student account"}</span>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="no-applications">
      No applications yet.
    </p>
  )}
</div>

<div className="project-footer">
  <button
  className={`button ${
    hasApplied || deadlinePassed ? "button--outline" : "button--dark"
  }`}
  onClick={handleApply}
  disabled={applying || hasApplied || deadlinePassed}
>
  {deadlinePassed
    ? "Applications Closed"
    : hasApplied
    ? "Applied ✓"
    : applying
    ? "Applying..."
    : "Apply to Project"}
</button>
</div>
        </div>
      </section>
    </main>
  );
}