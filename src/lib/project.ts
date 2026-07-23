import type { ConversionSettings, EmbroideryObject, ProjectDocument } from "../types";

export function createProject(name: string, objects: EmbroideryObject[], settings: ConversionSettings): ProjectDocument {
  const now = new Date().toISOString();
  return { format: "franzistitch-project", version: 1, name, objects, settings, createdAt: now, updatedAt: now };
}

export function serializeProject(project: ProjectDocument) {
  return JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2);
}

export function parseProject(content: string): ProjectDocument {
  const project = JSON.parse(content) as Partial<ProjectDocument>;
  if ((project.format !== "franzistitch-project" && project.format !== "stitchlite-project") || project.version !== 1 || !Array.isArray(project.objects) || !project.settings) {
    throw new Error("Die Datei ist kein gültiges FranziStitch-Projekt.");
  }
  const settings: ConversionSettings = {
    ...project.settings,
    exportFormat: project.settings.exportFormat ?? "dst",
  };
  return { ...project, settings, format: "franzistitch-project" } as ProjectDocument;
}
