export interface User{
    id: number, 
    name: string, 
    email: string,
    password: string 
}

export interface Project {
    id: number,
    user_id: number,
    name: string,
    description: string | null,
    created_at: Date,
    updated_at: Date,
    snippet_count?: number
}

export interface Snippet{
    id: number,
    code: string,
    title: string,
    description: string,
    language: string,
    user_id: number,
    project_id: number | null,
    created_at: Date
}

export interface Collection {
    id: number,
    user_id: number,
    name: string,
    description: string | null,
    created_at: Date,
    updated_at: Date,
    snippet_count?: number
}

export interface CollectionRef {
    id: number,
    name: string
}

export interface SnippetWithTags extends Snippet{
    tags: string[],
    collections: CollectionRef[]
}

export interface User{
    id: number,
    email: string,
    password: string,
    created_at: Date
}

export interface PublicUser{
    id: number,
    email: string,
    created_at: Date
}

export interface Tag{
    id: number,
    name: string
}

export interface SnippetTags{
    snippet_id: number,
    tag_id: number
}

export interface SnippetAnalysis{
    title: string,
    description: string,
    language: string,
    tags: string[]
}