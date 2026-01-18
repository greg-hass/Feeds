-- 004_add_readability_to_fts.sql
-- Add readability_content to full-text search index

-- Drop existing FTS table
DROP TABLE IF EXISTS articles_fts;

-- Recreate FTS table with readability_content included
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
    title,
    author,
    summary,
    content,
    readability_content,
    content='articles',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Recreate triggers to keep FTS in sync
DROP TRIGGER IF EXISTS articles_ai;
DROP TRIGGER IF EXISTS articles_ad;
DROP TRIGGER IF EXISTS articles_au;

CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
    INSERT INTO articles_fts(rowid, title, author, summary, content, readability_content)
    VALUES (NEW.id, NEW.title, NEW.author, NEW.summary, NEW.content, NEW.readability_content);
END;

CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
    INSERT INTO articles_fts(articles_fts, rowid, title, author, summary, content, readability_content)
    VALUES ('delete', OLD.id, OLD.title, OLD.author, OLD.summary, OLD.content, OLD.readability_content);
END;

CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
    INSERT INTO articles_fts(articles_fts, rowid, title, author, summary, content, readability_content)
    VALUES ('delete', OLD.id, OLD.title, OLD.author, OLD.summary, OLD.content, OLD.readability_content);
    INSERT INTO articles_fts(rowid, title, author, summary, content, readability_content)
    VALUES (NEW.id, NEW.title, NEW.author, NEW.summary, NEW.content, NEW.readability_content);
END;

-- Rebuild the FTS index from existing articles
INSERT INTO articles_fts(rowid, title, author, summary, content, readability_content)
SELECT id, title, author, summary, content, readability_content FROM articles;
