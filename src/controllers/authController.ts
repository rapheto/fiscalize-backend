import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AppError } from '../middlewares/errorMiddleware';
import { AuthRequest } from '../middlewares/authMiddleware';
import { assertPasswordPolicy } from '../utils/passwordPolicy';
import { OTP_PURPOSE, type CriticalAction } from '../services/otpService';

export const authController = {
  // Created by AI.
  // Updated by AI.
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { nome, email, senha, cpf, rua, numero, bairro, cidade, estado, cep, complemento } = req.body;
      
      // Validação de campos obrigatórios
      if (!nome || !email || !senha || !cpf || !rua || !numero || !bairro || !cidade || !estado || !cep) {
        throw new AppError(400, 'Campos obrigatórios: nome, email, senha, cpf e endereço completo');
      }
      
      // Validação de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError(400, 'E-mail inválido');
      }
      
      assertPasswordPolicy(senha);
      
      const usuario = await authService.register(nome, email, senha, {
        cpf: String(cpf), rua: String(rua), numero: String(numero), bairro: String(bairro),
        cidade: String(cidade), estado: String(estado).toUpperCase(), cep: String(cep),
        ...(complemento !== undefined && { complemento: String(complemento) }),
      });
      
      res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
    } catch (error) {
      next(error);
    }
  },

  // Updated by AI.
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha, deviceId, deviceName } = req.body;
      
      // Validação de campos obrigatórios
      if (!email || !senha) {
        throw new AppError(400, 'Campos obrigatórios: email, senha');
      }
      
      if (!deviceId || typeof deviceId !== 'string') {
        throw new AppError(400, 'Identificador do dispositivo obrigatório.');
      }

      const result = await authService.login(email, senha, deviceId, deviceName);
      if (result.mfaRequired) {
        res.status(200).json({
          mfaRequired: true,
          challengeToken: result.challengeToken,
          destination: result.destination,
        });
        return;
      }

      res.status(200).json({
        id: result.usuario.id,
        nome: result.usuario.nome,
        email: result.usuario.email,
        perfil: result.usuario.perfil,
        token: result.token,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async requestCriticalOtp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { action } = req.body as { action?: CriticalAction };
      const allowed: CriticalAction[] = ['password', 'export', 'delete', 'anonymization'];
      if (!action || !allowed.includes(action)) {
        throw new AppError(400, 'Ação crítica inválida.');
      }
      const challenge = await authService.createOtpChallenge(
        req.user!.id,
        OTP_PURPOSE.CRITICAL,
        action
      );
      res.status(200).json({
        challengeToken: challenge.challengeToken,
        destination: challenge.destination,
      });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { challengeToken, code, deviceId } = req.body;
      if (
        typeof challengeToken !== 'string' ||
        typeof code !== 'string' ||
        !/^\d{6}$/.test(code)
      ) {
        throw new AppError(400, 'Informe o token do desafio e um código de 6 dígitos.');
      }
      const result = await authService.verifyOtp(challengeToken, code, deviceId);
      if ('verificationToken' in result) {
        res.status(200).json({ verificationToken: result.verificationToken });
        return;
      }
      res.status(200).json({
        id: result.usuario.id,
        nome: result.usuario.nome,
        email: result.usuario.email,
        perfil: result.usuario.perfil,
        token: result.token,
        refreshToken: result.refreshToken,
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
        ...usuario.cidadao,
      });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { nome, email, rua, numero, bairro, cidade, estado, cep, complemento } = req.body;
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
        rua: rua ? String(rua).trim() : null,
        numero: numero ? String(numero).trim() : null,
        bairro: bairro ? String(bairro).trim() : null,
        cidade: cidade ? String(cidade).trim() : null,
        estado: estado ? String(estado).trim().toUpperCase() : null,
        cep: cep ? String(cep).trim() : null,
        complemento: complemento ? String(complemento).trim() : null,
      });

      res.status(200).json({
        ...usuario,
        ...usuario.cidadao,
      });
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { senhaAtual, novaSenha, confirmarNovaSenha } = req.body;
      await authService.consumeMfaVerification(req.user!.id, req.body.mfaToken, 'password');
      if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
        throw new AppError(400, 'Informe a senha atual, a nova senha e a confirmação.');
      }
      if (novaSenha !== confirmarNovaSenha) {
        throw new AppError(400, 'A confirmação da nova senha não confere.');
      }

      assertPasswordPolicy(String(novaSenha));
      await authService.changePassword(req.user!.id, String(senhaAtual), String(novaSenha));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  // Created by AI.
  async exportMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await authService.consumeMfaVerification(req.user!.id, req.body?.mfaToken, 'export');
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
      await authService.consumeMfaVerification(req.user!.id, req.body.mfaToken, mode === 'delete' ? 'delete' : 'anonymization');
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

  // Created by AI.
  async setAnonymization(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { enabled, senha } = req.body;
      if (typeof enabled !== 'boolean') {
        throw new AppError(400, 'Informe enabled como booleano.');
      }
      await authService.consumeMfaVerification(req.user!.id, req.body.mfaToken, 'anonymization');
      await authService.setAnonymization(req.user!.id, enabled, senha);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};