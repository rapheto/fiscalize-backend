import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AppError } from '../middlewares/errorMiddleware';
import { AuthRequest } from '../middlewares/authMiddleware';
import { assertPasswordPolicy } from '../utils/passwordPolicy';

export const authController = {
  // Created by AI.
  // Updated by AI.
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { nome, email, senha } = req.body;
      
      // Validação de campos obrigatórios
      if (!nome || !email || !senha) {
        throw new AppError(400, 'Campos obrigatórios: nome, email, senha');
      }
      
      // Validação de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError(400, 'E-mail inválido');
      }
      
      assertPasswordPolicy(senha);
      
      const usuario = await authService.register(nome, email, senha);
      
      res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
    } catch (error) {
      next(error);
    }
  },

  // Updated by AI.
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha } = req.body;
      
      // Validação de campos obrigatórios
      if (!email || !senha) {
        throw new AppError(400, 'Campos obrigatórios: email, senha');
      }
      
      const { usuario, token, refreshToken } = await authService.login(email, senha);

      res.status(200).json({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        token,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new AppError(400, 'Refresh token obrigatório.');
      }

      const { usuario, token, refreshToken: nextRefreshToken } =
        await authService.refresh(refreshToken);

      res.status(200).json({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        token,
        refreshToken: nextRefreshToken,
      });
    } catch (error) {
      next(error);
    }
  },

  // Updated by AI.
  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let token = req.cookies.token;

      if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
      }

      res.clearCookie('token');

      if (token) {
        await authService.addTokenToBlocklist(token);
      }

      if (req.body?.refreshToken) {
        await authService.revokeRefreshToken(req.body.refreshToken);
      }
      
      res.status(200).json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
      next(error);
    }
  },

  // Updated by AI.
  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Obtém o ID do usuário autenticado do token
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      // Busca os dados completos do usuário do banco
      const usuario = await authService.getUserById(usuarioId);

      res.status(200).json({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        status: usuario.status,
        criadoem: usuario.criadoem,
        cpf: usuario.cidadao?.cpf ?? null,
        endereco: usuario.cidadao?.endereco ?? null,
      });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { nome, email, cpf, endereco } = req.body;
      if (!nome || !email) {
        throw new AppError(400, 'Campos obrigatórios: nome, email.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(email))) {
        throw new AppError(400, 'E-mail inválido.');
      }

      const usuario = await authService.updateProfile(req.user!.id, {
        nome: String(nome).trim(),
        email: String(email).trim(),
        ...(cpf !== undefined && { cpf: cpf ? String(cpf).trim() : null }),
        ...(endereco !== undefined && {
          endereco: endereco ? String(endereco).trim() : null,
        }),
      });

      res.status(200).json({
        ...usuario,
        cpf: usuario.cidadao?.cpf ?? null,
        endereco: usuario.cidadao?.endereco ?? null,
      });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async exportMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await authService.exportPersonalData(req.user!.id);
      res.status(200).json({
        exportedAt: new Date().toISOString(),
        data: {
          ...data,
          cidadao: data.cidadao
            ? {
                ...data.cidadao,
                chamado: data.cidadao.chamado.map((chamado) => ({
                  ...chamado,
                  latitude: chamado.latitude.toString(),
                  longitude: chamado.longitude.toString(),
                })),
              }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async deleteMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { senha, mode } = req.body;
      if (!senha || !['delete', 'anonymize'].includes(mode)) {
        throw new AppError(400, 'Informe senha e mode (delete ou anonymize).');
      }

      await authService.deleteOrAnonymize(req.user!.id, String(senha), mode);
      res.clearCookie('token');
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};