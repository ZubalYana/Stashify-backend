export interface Snippet{
    id: number,
    code: string,
    title: string,
    description: string,
    language: string,
    user_id: number,
    created_at: Date
}

export interface SnippetWithTags extends Snippet{
    tags: string[],
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