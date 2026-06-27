# 🔥 HRSM — Sistema de Combate a Incêndio

Sistema mobile-first de controle de extintores e hidrantes do **Hospital Regional de Santa Maria**, com banco de dados Supabase em tempo real.

---

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- [VS Code](https://code.visualstudio.com/)
- Conta gratuita no [Supabase](https://supabase.com/)

---

## 🚀 Configuração passo a passo

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Dê um nome (ex: `hrsm-incendio`) e escolha uma senha forte
3. Aguarde o projeto ser criado (~1 min)

### 3. Criar as tabelas no Supabase

1. No painel do Supabase, acesse **SQL Editor** → **New query**
2. Cole o conteúdo do arquivo `supabase_setup.sql`
3. Clique em **Run** (▶)

### 4. Criar o usuário Admin

1. No Supabase, acesse **Authentication** → **Users** → **Invite user**
2. Insira o e-mail do administrador (ex: `admin@hrsm.gov.br`)
3. Após criar, vá ao **SQL Editor** e execute:

```sql
UPDATE public.perfis
SET role = 'admin', nome = 'Administrador'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@hrsm.gov.br');
```

4. Para definir a senha, acesse Authentication → Users → clique no usuário → **Send password reset**

### 5. Configurar variáveis de ambiente

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. No Supabase, acesse **Settings** → **API** e copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

3. Edite o `.env`:
```env
VITE_SUPABASE_URL=https://xyzxyzxyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. Rodar o projeto

```bash
npm run dev
```

Acesse: **http://localhost:3000**

---

## 📱 Usar no celular Android

1. Rode `npm run dev` no computador
2. Descubra o IP local do computador:
   - Windows: `ipconfig` no terminal
   - Mac/Linux: `ifconfig` ou `hostname -I`
3. No celular (mesma rede Wi-Fi), acesse: `http://192.168.x.x:3000`

Para tornar acessível na rede, edite o `vite.config.js`:
```js
server: {
  port: 3000,
  host: '0.0.0.0',  // ← adicione esta linha
  open: true
}
```

---

## 🏗️ Fazer build para produção

```bash
npm run build
```

Os arquivos estarão na pasta `dist/`. Hospede em qualquer serviço estático:
- [Netlify](https://netlify.com) — arraste a pasta `dist`
- [Vercel](https://vercel.com) — conecte o repositório GitHub
- [GitHub Pages](https://pages.github.com)

---

## 🗂️ Estrutura do projeto

```
hrsm-incendio/
├── index.html           # HTML principal
├── package.json
├── vite.config.js
├── supabase_setup.sql   # Script SQL para criar as tabelas
├── .env                 # Suas chaves (não commitar!)
├── .env.example         # Template das chaves
└── src/
    ├── main.js          # Lógica principal da UI
    ├── supabase.js      # Inicialização do cliente Supabase
    ├── auth.js          # Login, logout, usuários
    ├── db.js            # CRUD de extintores e hidrantes
    ├── relatorio.js     # Geração do relatório HTML para impressão
    ├── utils.js         # Funções utilitárias
    └── style.css        # Estilos mobile-first
```

---

## ✨ Funcionalidades

- ✅ Login com e-mail e senha via Supabase Auth
- ✅ Perfis: **Admin** e **Usuário**
- ✅ Admin pode criar e remover usuários
- ✅ Cadastro completo de **extintores** (AP, BC, ABC, CO₂)
- ✅ Cadastro completo de **hidrantes** e mangotinhos
- ✅ Ordenação automática por número
- ✅ Filtros por classe, status, marca e local
- ✅ Status automático: Em dia / Atenção (60 dias) / Vencido
- ✅ Fluxo de **manutenção**: envio e retorno com histórico
- ✅ **Relatório completo** com download de arquivo HTML para impressão
- ✅ Nome do usuário registrado em cada atualização
- ✅ **Tempo real**: mudanças de outros usuários aparecem automaticamente
- ✅ Interface 100% mobile-first, otimizada para Android

---

## 🔒 Segurança

- Autenticação gerenciada pelo Supabase Auth (JWT)
- Row Level Security (RLS) ativado em todas as tabelas
- Somente usuários autenticados leem/escrevem dados
- Chave `anon` não dá acesso admin — operações admin exigem autenticação
