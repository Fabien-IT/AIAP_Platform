import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import { existsSync, mkdirSync, writeFile } from 'node:fs';
import { PrismaClient, Role, MembershipStatus, EventStatus, TransactionType } from '@prisma/client';
import { z } from 'zod';
import { AP_CITIES, AP_LOCATION_CATALOG } from './locationCatalog';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_LONG_RANDOM_SECRET';
if (process.env.NODE_ENV === 'production' && JWT_SECRET.startsWith('CHANGE_ME')) throw new Error('JWT_SECRET must be configured in production');

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedVideoMime = new Set(['video/mp4','video/webm','video/quicktime']);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (origin, cb) => {
  const localDev = process.env.NODE_ENV !== 'production' && !!origin && /^http:\/\/localhost:\d+$/.test(origin);
  if (!origin || allowedOrigins.includes(origin) || localDev) return cb(null, true);
  return cb(new Error('CORS origin not allowed'));
}, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));
app.use(morgan('combined'));

interface AuthRequest extends Request { user?: { id: string; role: Role; email: string; mustChangePassword?: boolean } }
const audit = async (actorUserId: string | undefined, action: string, entity: string, entityId?: string, metadata?: unknown) => {
  await prisma.auditLog.create({ data: { actorUserId, action, entity, entityId, metadata: metadata as any } });
};
const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const raw = req.headers.authorization;
  if (!raw?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(raw.slice(7), JWT_SECRET) as AuthRequest['user'];
    if (req.user?.mustChangePassword && req.path !== '/api/auth/change-password' && req.path !== '/api/auth/me') {
      return res.status(428).json({ error: 'Password change required before using AIAP.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    next();
  } catch { return res.status(401).json({ error: 'Invalid or expired session' }); }
};
const allow = (...roles: Role[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};
const associationRoles: Role[] = [Role.MEMBER,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT,Role.TREASURER,Role.COMMUNICATION,Role.EVENT_ORGANIZER,Role.COORDINATOR];
const memberManagementRoles: Role[] = [Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT];
const memberDirectoryRoles: Role[] = [...memberManagementRoles, Role.COORDINATOR];
const singleSeatRoles: Role[] = [Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT,Role.TREASURER,Role.COMMUNICATION];
const enforceAssociationRole = async (role: Role, userId: string, city?: string | null) => {
  if (role === Role.SUPER_ADMIN) return;
  const target = await prisma.user.findUnique({where:{id:userId},include:{member:true}});
  if (!target?.member) throw new Error('An association role requires a member profile.');
  if (singleSeatRoles.includes(role)) {
    const existing = await prisma.user.findFirst({where:{role,active:true,id:{not:userId}}});
    if (existing) throw new Error(`Only one active ${role.replaceAll('_',' ')} is allowed.`);
  }
  if (role === Role.COORDINATOR) {
    const cityName = String(city ?? target.member.city ?? '').trim();
    if (!cityName) throw new Error('A Coordinator must have a city.');
    const existing = await prisma.user.findFirst({where:{role:Role.COORDINATOR,active:true,id:{not:userId},member:{city:{equals:cityName,mode:'insensitive'}}}});
    if (existing) throw new Error(`An active Coordinator already exists for ${cityName}.`);
  }
};

const publicMember = (m: any) => ({ id:m.id, memberNumber:m.memberNumber, fullName:m.fullName, city:m.city, university:m.university, fieldOfStudy:m.fieldOfStudy, status:m.status, membershipStatus:m.membershipStatus, photoUrl:m.photoUrl, publicProfile:m.publicProfile });

app.get('/api/health', (_req,res)=>res.json({ok:true,service:'AIAP API',time:new Date().toISOString()}));
app.get('/api/reference/locations', (_req,res)=>res.json({cities:AP_CITIES,universitiesByCity:AP_LOCATION_CATALOG}));

app.post('/api/uploads/member-photo', express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '5mb' }), (req,res) => {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  if (!allowedMime.has(contentType) || body.length === 0) return res.status(400).json({ error: 'A valid photo is required (JPG, PNG or WebP, max 5 MB).' });
  const ext = contentType === 'image/png' ? '.png' : contentType === 'image/webp' ? '.webp' : '.jpg';
  const filename = `member-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  writeFile(path.join(uploadDir, filename), body, (err) => {
    if (err) return res.status(500).json({ error: 'Unable to save photo.' });
    res.status(201).json({ photoUrl: `/uploads/${filename}` });
  });
});

app.post('/api/uploads/image', auth, allow(Role.SUPER_ADMIN, Role.PRESIDENT, Role.SECRETARIAT, Role.COMMUNICATION), express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), (req,res) => {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  if (!allowedMime.has(contentType) || body.length === 0) return res.status(400).json({ error: 'A valid image is required (JPG, PNG or WebP, max 8 MB).' });
  const ext = contentType === 'image/png' ? '.png' : contentType === 'image/webp' ? '.webp' : '.jpg';
  const filename = `image-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  writeFile(path.join(uploadDir, filename), body, (err) => {
    if (err) return res.status(500).json({ error: 'Unable to save image.' });
    res.status(201).json({ imageUrl: `/uploads/${filename}`, mediaType: 'IMAGE' });
  });
});

app.post('/api/uploads/profile-photo', auth, allow(Role.SUPER_ADMIN, Role.PRESIDENT, Role.VICE_PRESIDENT, Role.SECRETARIAT, Role.TREASURER, Role.COMMUNICATION, Role.EVENT_ORGANIZER, Role.COORDINATOR, Role.MEMBER), express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '5mb' }), (req,res) => {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  if (!allowedMime.has(contentType) || body.length === 0) return res.status(400).json({ error: 'A valid profile photo is required (JPG, PNG or WebP, max 5 MB).' });
  const ext = contentType === 'image/png' ? '.png' : contentType === 'image/webp' ? '.webp' : '.jpg';
  const filename = `profile-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  writeFile(path.join(uploadDir, filename), body, (err) => {
    if (err) return res.status(500).json({ error: 'Unable to save profile photo.' });
    res.status(201).json({ photoUrl: `/uploads/${filename}` });
  });
});

const optionalText = (max:number) => z.preprocess(v => typeof v === 'string' && v.trim() === '' ? undefined : v, z.string().trim().max(max).optional());
const optionalDate = z.preprocess(v => typeof v === 'string' && v.trim() === '' ? undefined : v, z.string().optional());
const registrationSchema = z.object({
  fullName:z.string().trim().min(2, 'Full name is required').max(120),
  email:z.string().email('Enter a valid email address').max(200),
  phone:z.string().trim().min(7, 'Enter a valid phone number').max(30),
  city:z.string().trim().refine(v=>AP_CITIES.includes(v), 'Choose a city from the Andhra Pradesh list.'),
  address:optionalText(300),
  status:z.string().trim().min(2, 'Status is required').max(60),
  university:optionalText(160),
  fieldOfStudy:optionalText(160),
  dateOfBirth:optionalDate,
  emergencyName:optionalText(120),
  emergencyPhone:optionalText(30),
  password:z.string().min(8, 'Password must contain at least 8 characters').max(128),
  photoUrl:z.string().trim().min(1, 'Profile photo is mandatory').regex(/^\/uploads\//, 'Photo must be uploaded through AIAP.'),
  publicProfile:z.boolean().default(false)
}).superRefine((data,ctx)=>{
  if(data.status.toLowerCase()==='student' && !data.university){
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['university'],message:'Choose the university/institution for the selected city.'});
  }
  if(data.university && AP_CITIES.includes(data.city) && !AP_LOCATION_CATALOG[data.city].includes(data.university)){
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['university'],message:'Choose a university/institution listed for the selected city.'});
  }
});
app.post('/api/members/registrations', async (req,res) => {
  const p=registrationSchema.safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Invalid registration data',details:p.error.flatten(),fields:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  try {
    const existing=await prisma.user.findUnique({where:{email:p.data.email.toLowerCase()}}); if(existing) return res.status(409).json({error:'An account with this email already exists'});
    const pending=await prisma.registration.findFirst({where:{email:p.data.email.toLowerCase(),status:'PENDING'}}); if(pending) return res.status(409).json({error:'A registration is already pending'});
    const hash=await bcrypt.hash(p.data.password,12); const {password,...safe}=p.data;
    const result=await prisma.$transaction(async tx=>{
      const user=await tx.user.create({data:{email:p.data.email.toLowerCase(),passwordHash:hash,role:Role.MEMBER,active:false}});
      const member=await tx.member.create({data:{userId:user.id,fullName:p.data.fullName,photoUrl:p.data.photoUrl,phone:p.data.phone,city:p.data.city,address:p.data.address,status:p.data.status,university:p.data.university,fieldOfStudy:p.data.fieldOfStudy,dateOfBirth:p.data.dateOfBirth?new Date(p.data.dateOfBirth):undefined,emergencyName:p.data.emergencyName,emergencyPhone:p.data.emergencyPhone,membershipStatus:MembershipStatus.PENDING,publicProfile:p.data.publicProfile}});
      const reg=await tx.registration.create({data:{email:user.email,fullName:p.data.fullName,payload:safe}}); return {user,member,reg};
    });
    await audit(result.user.id,'REGISTRATION_SUBMITTED','Registration',result.reg.id); res.status(201).json({message:'Registration submitted. The Secretariat will verify it before activation.',status:'PENDING'});
  } catch(e){ console.error(e); res.status(500).json({error:'Unable to complete registration'}); }
});

app.post('/api/auth/login',async(req,res)=>{
  const p=z.object({email:z.string().email(),password:z.string()}).safeParse(req.body); if(!p.success)return res.status(400).json({error:'Invalid credentials'});
  const u=await prisma.user.findUnique({where:{email:p.data.email.toLowerCase()},include:{member:true}});
  if(!u||!u.active||!(await bcrypt.compare(p.data.password,u.passwordHash))) return res.status(401).json({error:'Email/password is incorrect or the account is not active'});
  await prisma.user.update({where:{id:u.id},data:{lastLoginAt:new Date()}}); const token=jwt.sign({id:u.id,email:u.email,role:u.role,mustChangePassword:u.mustChangePassword},JWT_SECRET,{expiresIn:'8h'});
  await audit(u.id,'LOGIN','User',u.id); res.json({token,user:{id:u.id,email:u.email,role:u.role,mustChangePassword:u.mustChangePassword,member:u.member?publicMember(u.member):null}});
});
app.get('/api/auth/me',auth,async(req:AuthRequest,res)=>{const u=await prisma.user.findUnique({where:{id:req.user!.id},include:{member:true}}); if(!u)return res.status(404).json({error:'User not found'}); res.json({id:u.id,email:u.email,role:u.role,mustChangePassword:u.mustChangePassword,member:u.member?publicMember(u.member):null});});
app.post('/api/auth/change-password',auth,async(req:AuthRequest,res)=>{
  const p=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(8,'New password must contain at least 8 characters.').max(128),confirmPassword:z.string().min(8)}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Invalid password data',fields:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  if(p.data.newPassword!==p.data.confirmPassword)return res.status(400).json({error:'New password and confirmation do not match.'});
  const u=await prisma.user.findUnique({where:{id:req.user!.id},include:{member:true}});
  if(!u)return res.status(404).json({error:'User not found'});
  if(!await bcrypt.compare(p.data.currentPassword,u.passwordHash))return res.status(400).json({error:'Current password is incorrect.'});
  if(await bcrypt.compare(p.data.newPassword,u.passwordHash))return res.status(400).json({error:'Choose a different password from the current password.'});
  await prisma.user.update({where:{id:u.id},data:{passwordHash:await bcrypt.hash(p.data.newPassword,12),mustChangePassword:false}});
  await audit(u.id,'PASSWORD_CHANGED','User',u.id,{forced:req.user!.mustChangePassword===true});
  const token=jwt.sign({id:u.id,email:u.email,role:u.role,mustChangePassword:false},JWT_SECRET,{expiresIn:'8h'});
  res.json({token,user:{id:u.id,email:u.email,role:u.role,mustChangePassword:false,member:u.member?publicMember(u.member):null}});
});

app.get('/api/members',(_req,res)=>res.status(404).json({error:'The public member directory is disabled. Member records are private.'}));
app.get('/api/members/all',auth,allow(...memberDirectoryRoles),async(req:AuthRequest,res)=>{
  const q=String(req.query.q||'').trim(),city=String(req.query.city||''),university=String(req.query.university||''),field=String(req.query.field||''),status=String(req.query.status||''),memberType=String(req.query.memberType||req.query.statusType||''),membershipStatus=String(req.query.membershipStatus||MembershipStatus.ACTIVE),associationRole=String(req.query.associationRole||'');
  const isCoordinator=req.user!.role===Role.COORDINATOR;
  const owner=await prisma.member.findUnique({where:{userId:req.user!.id},select:{city:true}});
  const scopedCity=isCoordinator?String(owner?.city||'').trim():city;
  if(isCoordinator && !scopedCity) return res.status(403).json({error:'Your Coordinator account has no city assigned.'});
  const userWhere:any={role:{not:Role.SUPER_ADMIN}}; if(associationRole) userWhere.role=associationRole as Role;
  const where:any={user:userWhere,...(membershipStatus?{membershipStatus:membershipStatus as MembershipStatus}:{}),...(scopedCity?{city:scopedCity}:{}),...(university?{university}:{}),...(field?{fieldOfStudy:field}:{}),...(status && status!=='Student' && status!=='Non-student'?{status:{equals:status,mode:'insensitive'}}:{})};
  const and:any[]=[];
  if(q) and.push({OR:[{fullName:{contains:q,mode:'insensitive'}},{memberNumber:{contains:q,mode:'insensitive'}},{phone:{contains:q,mode:'insensitive'}}]});
  if(status.toLowerCase()==='student'||memberType.toUpperCase()==='STUDENT') and.push({status:{equals:'Student',mode:'insensitive'}});
  if(status.toLowerCase()==='non-student'||memberType.toUpperCase()==='NON_STUDENT') and.push({NOT:{status:{equals:'Student',mode:'insensitive'}}});
  if(and.length) where.AND=and;
  const ms=await prisma.member.findMany({where,include:{user:{select:{email:true,role:true}}},orderBy:{fullName:'asc'}});
  res.json(ms.map(m=>({...publicMember(m),phone:m.phone,email:m.user?.email||'',associationRole:m.user?.role||Role.MEMBER})));
});
app.get('/api/members/:id/details',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT,Role.COORDINATOR),async(req:AuthRequest,res)=>{
  const m=await prisma.member.findUnique({where:{id:req.params.id},include:{user:{select:{id:true,email:true,role:true,active:true,createdAt:true,lastLoginAt:true}}}});
  if(!m)return res.status(404).json({error:'Member not found'});
  if(req.user!.role===Role.COORDINATOR){
    const own=await prisma.member.findUnique({where:{userId:req.user!.id},select:{city:true}});
    if(!own?.city || own.city.trim().toLowerCase()!==m.city.trim().toLowerCase()) return res.status(403).json({error:'Coordinator access is limited to your city.'});
  }
  const {profession: _legacyProfession, ...safeMember}=m as any; res.json({...safeMember,user:m.user});
});
app.get('/api/members/export.csv',auth,allow(...memberDirectoryRoles),async(req:AuthRequest,res)=>{
  const q=String(req.query.q||'').trim(),city=String(req.query.city||''),university=String(req.query.university||''),field=String(req.query.field||''),status=String(req.query.status||''),memberType=String(req.query.memberType||''),membershipStatus=String(req.query.membershipStatus||MembershipStatus.ACTIVE),associationRole=String(req.query.associationRole||'');
  const exportOwner=req.user!.role===Role.COORDINATOR?await prisma.member.findUnique({where:{userId:req.user!.id},select:{city:true}}):null;
  const exportCity=req.user!.role===Role.COORDINATOR?String(exportOwner?.city||'').trim():city;
  const userWhere:any={role:{not:Role.SUPER_ADMIN}}; if(associationRole) userWhere.role=associationRole as Role;
  const where:any={user:userWhere,...(membershipStatus?{membershipStatus:membershipStatus as MembershipStatus}:{}),...(exportCity?{city:exportCity}:{}),...(university?{university}:{}),...(field?{fieldOfStudy:field}:{}),...(status?{status:{equals:status,mode:'insensitive'}}:{})};
  const and:any[]=[];
  if(q) and.push({OR:[{fullName:{contains:q,mode:'insensitive'}},{memberNumber:{contains:q,mode:'insensitive'}}]});
  const studentOr=[{status:{equals:'Student',mode:'insensitive'}}];
  const memberTypeUpper=memberType.trim().toUpperCase().replace(/\s+/g,'_');
  if(memberTypeUpper==='STUDENT') and.push({OR:studentOr});
  if(memberTypeUpper==='NON_STUDENT') and.push({NOT:{OR:studentOr}});
  if(and.length) where.AND=and;
  const ms=await prisma.member.findMany({where,include:{user:{select:{role:true}}},orderBy:{fullName:'asc'}});
  const esc=(v:any)=>`"${String(v??'').replaceAll('"','""')}"`;
  const rows=[['Member ID','Name','City','Mobile','University','Filiere','Status','Association Role','Membership Status'],...ms.map(m=>[m.memberNumber,m.fullName,m.city,m.phone,m.university,m.fieldOfStudy,m.status,m.user?.role||Role.MEMBER,m.membershipStatus])];
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=aiap-members.csv');res.send(rows.map(r=>r.map(esc).join(',')).join('\n'));
});
app.patch('/api/members/:id/status',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT),async(req:AuthRequest,res)=>{const p=z.object({membershipStatus:z.nativeEnum(MembershipStatus)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid membership status'});const before=await prisma.member.findUnique({where:{id:req.params.id},include:{user:true}});if(!before)return res.status(404).json({error:'Member not found'});if(before.user?.role===Role.SUPER_ADMIN)return res.status(409).json({error:'Super Admin is a system account, not an association member.'});if(p.data.membershipStatus===MembershipStatus.ACTIVE&&before.user?.role===Role.COORDINATOR)await enforceAssociationRole(Role.COORDINATOR,before.userId||'',before.city);const active=p.data.membershipStatus===MembershipStatus.ACTIVE;const memberNumber=active?(before.memberNumber||`AIAP-${new Date().getFullYear()}-${crypto.randomInt(10000,99999)}`):before.memberNumber;const m=await prisma.member.update({where:{id:before.id},data:{membershipStatus:p.data.membershipStatus,approvedAt:active?(before.approvedAt||new Date()):null,memberNumber}});if(m.userId) await prisma.user.update({where:{id:m.userId},data:{active}});await audit(req.user!.id,'MEMBER_STATUS_CHANGED','Member',m.id,{status:p.data.membershipStatus});res.json(publicMember(m));});
const memberUpdateSchema=z.object({
  fullName:z.string().trim().min(2).max(120).optional(),
  phone:z.string().trim().min(7).max(30).optional().nullable(),
  city:z.string().trim().min(2).max(100).optional(),
  address:z.string().max(300).optional().nullable(),
  status:z.string().trim().min(2).max(60).optional(),
  university:z.string().max(160).optional().nullable(),
  fieldOfStudy:z.string().max(160).optional().nullable(),
  dateOfBirth:z.string().optional().nullable(),
  emergencyName:z.string().max(120).optional().nullable(),
  emergencyPhone:z.string().max(30).optional().nullable(),
  photoUrl:z.string().regex(/^\/uploads\//).optional().nullable(),
  publicProfile:z.boolean().optional()
});
app.patch('/api/members/:id',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT),async(req:AuthRequest,res)=>{
  const p=memberUpdateSchema.safeParse(req.body); if(!p.success)return res.status(400).json({error:'Invalid member data',fields:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const data:any={...p.data};
  if(data.dateOfBirth!==undefined) data.dateOfBirth=data.dateOfBirth?new Date(data.dateOfBirth):null;
  const before=await prisma.member.findUnique({where:{id:req.params.id},include:{user:true}});if(!before)return res.status(404).json({error:'Member not found'});if(before.user?.role===Role.SUPER_ADMIN)return res.status(409).json({error:'Super Admin is a system account, not an association member.'});if(before.user?.role===Role.COORDINATOR&&data.city!==undefined&&String(data.city).trim().toLowerCase()!==String(before.city).trim().toLowerCase())await enforceAssociationRole(Role.COORDINATOR,before.userId||'',data.city);const m=await prisma.member.update({where:{id:req.params.id},data,include:{user:{select:{id:true,email:true,role:true,active:true,createdAt:true,lastLoginAt:true}}}});
  await audit(req.user!.id,'MEMBER_UPDATED','Member',m.id,{fields:Object.keys(p.data)});
  res.json(m);
});
app.delete('/api/members/:id',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT),async(req:AuthRequest,res)=>{
  const m=await prisma.member.findUnique({where:{id:req.params.id},include:{user:true}}); if(!m)return res.status(404).json({error:'Member not found'});
  if(m.user?.role && m.user.role!==Role.MEMBER) return res.status(409).json({error:'Official association accounts cannot be deleted from the member directory. Deactivate the account instead.'});
  const contributionCount=await prisma.contribution.count({where:{memberId:m.id}}); if(contributionCount>0){await audit(req.user!.id,'MEMBER_DELETE_BLOCKED','Member',m.id,{contributionCount,reason:'FINANCIAL_HISTORY'});return res.status(409).json({error:`Delete blocked: ${m.fullName} has ${contributionCount} financial contribution record(s). Deactivate the member instead to preserve the accounting history.`});}
  await prisma.$transaction(async tx=>{await tx.eventRegistration.deleteMany({where:{memberId:m.id}});await tx.member.delete({where:{id:m.id}});if(m.userId)await tx.user.delete({where:{id:m.userId}});});
  await audit(req.user!.id,'MEMBER_DELETED','Member',m.id,{fullName:m.fullName}); res.json({deleted:true,id:m.id});
});
app.post('/api/uploads/video', auth, allow(Role.SUPER_ADMIN, Role.COMMUNICATION), express.raw({ type: ['video/mp4','video/webm','video/quicktime'], limit: '60mb' }), (req,res) => {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  if (!allowedVideoMime.has(contentType) || body.length === 0) return res.status(400).json({ error: 'A valid video is required (MP4, WebM or MOV, max 60 MB).' });
  const ext = contentType === 'video/webm' ? '.webm' : contentType === 'video/quicktime' ? '.mov' : '.mp4';
  const filename = `activity-video-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  writeFile(path.join(uploadDir, filename), body, (err) => {
    if (err) return res.status(500).json({ error: 'Unable to save video.' });
    res.status(201).json({ videoUrl: `/uploads/${filename}`, mediaType: 'VIDEO' });
  });
});

app.delete('/api/admin/members/all',auth,allow(Role.SUPER_ADMIN),async(req:AuthRequest,res)=>{
  const confirmation=String(req.body?.confirmation||'');
  if(confirmation!=='DELETE ALL MEMBERS') return res.status(400).json({error:'Type DELETE ALL MEMBERS to confirm this destructive action.'});
  try {
    const result=await prisma.$transaction(async tx=>{
      const count=await tx.member.count();
      const contributions=await tx.contribution.count();
      if(contributions>0) throw new Error(`Cannot delete all member profiles while ${contributions} contribution record(s) exist. Export/reconcile them first.`);
      await tx.eventRegistration.deleteMany({});
      await tx.member.deleteMany({});
      return count;
    });
    await audit(req.user!.id,'ALL_MEMBERS_DELETED','Member','ALL',{count:result});
    res.json({deleted:result,preservedUsers:true,preservedContributions:true});
  } catch(e:any) {
    if(String(e?.message||'').startsWith('Cannot delete all member profiles')) return res.status(409).json({error:e.message});
    throw e;
  }
});

app.get('/api/admin/users',auth,allow(Role.SUPER_ADMIN),async(_req,res)=>{const us=await prisma.user.findMany({include:{member:true},orderBy:{createdAt:'desc'}});res.json(us.map(u=>({id:u.id,email:u.email,role:u.role,active:u.active,createdAt:u.createdAt,member:u.member?publicMember(u.member):null})));});
app.patch('/api/admin/users/:id/role',auth,allow(Role.SUPER_ADMIN),async(req:AuthRequest,res)=>{const p=z.object({role:z.nativeEnum(Role),city:z.string().optional()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid role'});if(req.params.id===req.user!.id&&p.data.role!==Role.SUPER_ADMIN)return res.status(400).json({error:'You cannot remove your own Super Admin role'});try{const target=await prisma.user.findUnique({where:{id:req.params.id},include:{member:true}});if(!target)return res.status(404).json({error:'User not found'});const nextCity=p.data.city?.trim()||target.member?.city||'';if(p.data.role===Role.COORDINATOR&&!AP_CITIES.includes(nextCity))return res.status(400).json({error:'Choose a valid Andhra Pradesh city for the Coordinator.'});if(p.data.role!==Role.SUPER_ADMIN&&!target.member)throw new Error('An association role requires a member profile.');await enforceAssociationRole(p.data.role,target.id,nextCity);const u=await prisma.user.update({where:{id:req.params.id},data:{role:p.data.role,active:p.data.role===Role.SUPER_ADMIN?target.active:true}});if(p.data.role!==Role.SUPER_ADMIN&&target.member){await prisma.member.update({where:{id:target.member.id},data:{membershipStatus:MembershipStatus.ACTIVE,approvedAt:target.member.approvedAt||new Date(),memberNumber:target.member.memberNumber||`AIAP-${new Date().getFullYear()}-${crypto.randomInt(10000,99999)}`,...(p.data.role===Role.COORDINATOR&&nextCity?{city:nextCity}:{})}});}await audit(req.user!.id,'ROLE_CHANGED','User',u.id,{role:u.role,city:p.data.role===Role.COORDINATOR?nextCity:undefined});res.json({id:u.id,email:u.email,role:u.role,active:u.active,city:p.data.role===Role.COORDINATOR?nextCity:(target.member?.city||null)});}catch(e){res.status(409).json({error:e instanceof Error?e.message:'Unable to assign role'});}});
app.post('/api/admin/users/:id/reset-password',auth,allow(Role.SUPER_ADMIN),async(req:AuthRequest,res)=>{
  if(req.params.id===req.user!.id) return res.status(400).json({error:'Use your personal password change flow for your own account.'});
  const u=await prisma.user.findUnique({where:{id:req.params.id}});
  if(!u) return res.status(404).json({error:'User not found'});
  const temporaryPassword=crypto.randomBytes(12).toString('base64url').slice(0,16)+'Aa1!';
  await prisma.user.update({where:{id:u.id},data:{passwordHash:await bcrypt.hash(temporaryPassword,12),mustChangePassword:true}});
  await audit(req.user!.id,'PASSWORD_RESET','User',u.id);
  res.json({id:u.id,email:u.email,temporaryPassword});
});

app.post('/api/admin/users/reset-passwords',auth,allow(Role.SUPER_ADMIN),async(req:AuthRequest,res)=>{
  const users=await prisma.user.findMany({orderBy:{email:'asc'}});
  const credentials:{id:string;email:string;role:Role;temporaryPassword:string}[]=[];
  await prisma.$transaction(async tx=>{
    for(const u of users){
      const temporaryPassword=crypto.randomBytes(12).toString('base64url').slice(0,16)+'Aa1!';
      await tx.user.update({where:{id:u.id},data:{passwordHash:await bcrypt.hash(temporaryPassword,12),mustChangePassword:true}});
      credentials.push({id:u.id,email:u.email,role:u.role,temporaryPassword});
    }
  });
  await audit(req.user!.id,'ALL_PASSWORDS_RESET','User','ALL',{count:users.length});
  res.json({count:credentials.length,credentials});
});

app.patch('/api/admin/users/:id/active',auth,allow(Role.SUPER_ADMIN),async(req:AuthRequest,res)=>{const p=z.object({active:z.boolean()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid status'});if(req.params.id===req.user!.id&&p.data.active===false)return res.status(400).json({error:'You cannot deactivate your own Super Admin account'});const target=await prisma.user.findUnique({where:{id:req.params.id},include:{member:true}});if(!target)return res.status(404).json({error:'User not found'});try{if(p.data.active)await enforceAssociationRole(target.role,target.id,target.member?.city);}catch(e){return res.status(409).json({error:e instanceof Error?e.message:'Unable to activate account'});}const u=await prisma.user.update({where:{id:req.params.id},data:{active:p.data.active}});await audit(req.user!.id,'USER_ACTIVE_CHANGED','User',u.id,{active:u.active});res.json({id:u.id,email:u.email,role:u.role,active:u.active});});

const mediaUrlSchema=z.string().refine(v=>/^https?:\/\//.test(v)||/^\/uploads\//.test(v),'Media must be a public URL or an AIAP upload URL.');
const activitySchema=z.object({title:z.string().min(3),slug:z.string().min(3).regex(/^[a-z0-9-]+$/),date:z.string(),location:z.string().max(160).optional(),description:z.string().min(3),coverImageUrl:mediaUrlSchema.optional(),published:z.boolean().default(false),images:z.array(z.object({url:mediaUrlSchema,mediaType:z.enum(['IMAGE','VIDEO']).default('IMAGE'),altText:z.string().max(160).optional()})).default([])});
app.get('/api/activities',async(_req,res)=>res.json(await prisma.activity.findMany({where:{published:true},include:{images:{orderBy:{sortOrder:'asc'}},_count:{select:{participations:true}}},orderBy:{date:'desc'}})));
app.get('/api/activities/all',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION),async(_req,res)=>res.json(await prisma.activity.findMany({include:{images:true,_count:{select:{participations:true}}},orderBy:{date:'desc'}})));
app.get('/api/activities/:slug',async(req,res)=>{const a=await prisma.activity.findFirst({where:{published:true,OR:[{slug:req.params.slug},{id:req.params.slug}]},include:{images:{orderBy:{sortOrder:'asc'}},_count:{select:{participations:true}}}});if(!a)return res.status(404).json({error:'Activity not found'});res.json(a);});
app.get('/api/activities/:id/participation',auth,async(req:AuthRequest,res)=>{const m=await prisma.member.findUnique({where:{userId:req.user!.id}});if(!m||req.user!.role===Role.SUPER_ADMIN||m.membershipStatus!==MembershipStatus.ACTIVE)return res.json({participating:false,participantCount:0});const a=await prisma.activity.findUnique({where:{id:req.params.id},include:{_count:{select:{participations:true}}}});if(!a||!a.published)return res.status(404).json({error:'Activity not found'});const p=await prisma.activityParticipation.findUnique({where:{activityId_memberId:{activityId:a.id,memberId:m.id}}});res.json({participating:!!p,participantCount:a._count.participations});});
app.post('/api/activities/:id/participate',auth,async(req:AuthRequest,res)=>{if(req.user!.role===Role.SUPER_ADMIN)return res.status(403).json({error:'Super Admin is not an association member.'});const m=await prisma.member.findUnique({where:{userId:req.user!.id}});if(!m||m.membershipStatus!==MembershipStatus.ACTIVE)return res.status(403).json({error:'An active AIAP membership is required.'});const a=await prisma.activity.findUnique({where:{id:req.params.id}});if(!a||!a.published)return res.status(404).json({error:'Activity not found'});await prisma.activityParticipation.upsert({where:{activityId_memberId:{activityId:a.id,memberId:m.id}},update:{},create:{activityId:a.id,memberId:m.id}});const count=await prisma.activityParticipation.count({where:{activityId:a.id}});await audit(req.user!.id,'ACTIVITY_PARTICIPATED','Activity',a.id,{memberId:m.id});res.json({participating:true,participantCount:count});});
app.delete('/api/activities/:id/participate',auth,async(req:AuthRequest,res)=>{if(req.user!.role===Role.SUPER_ADMIN)return res.status(403).json({error:'Super Admin is not an association member.'});const m=await prisma.member.findUnique({where:{userId:req.user!.id}});if(!m)return res.status(404).json({error:'Member profile not found'});await prisma.activityParticipation.deleteMany({where:{activityId:req.params.id,memberId:m.id}});const count=await prisma.activityParticipation.count({where:{activityId:req.params.id}});res.json({participating:false,participantCount:count});});
app.get('/api/activities/:id/participants',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION,Role.EVENT_ORGANIZER),async(req,res)=>{const rows=await prisma.activityParticipation.findMany({where:{activityId:req.params.id},include:{member:{select:{id:true,memberNumber:true,fullName:true,city:true,photoUrl:true}}},orderBy:{createdAt:'asc'}});res.json({count:rows.length,participants:rows.map(x=>({...x.member,joinedAt:x.createdAt}))});});

app.post('/api/activities',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION),async(req:AuthRequest,res)=>{const p=activitySchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid activity',details:p.error.flatten()});try{const a=await prisma.activity.create({data:{title:p.data.title,slug:p.data.slug,date:new Date(p.data.date),location:p.data.location,description:p.data.description,coverImageUrl:p.data.coverImageUrl,published:p.data.published,createdBy:req.user!.id,images:{create:p.data.images.map((x,i)=>({...x,sortOrder:i}))}},include:{images:true}});await audit(req.user!.id,'ACTIVITY_CREATED','Activity',a.id);res.status(201).json(a);}catch(e){res.status(400).json({error:'Could not create activity; slug may already exist'});}});
app.patch('/api/activities/:id',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION),async(req:AuthRequest,res)=>{const p=activitySchema.partial().safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid activity'});const a=await prisma.activity.update({where:{id:req.params.id},data:{...p.data,date:p.data.date?new Date(p.data.date):undefined}});await audit(req.user!.id,'ACTIVITY_UPDATED','Activity',a.id);res.json(a);});
app.post('/api/activities/:id/media',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION),async(req:AuthRequest,res)=>{
  const p=z.object({url:mediaUrlSchema,mediaType:z.enum(['IMAGE','VIDEO']),altText:z.string().max(160).optional(),caption:z.string().max(500).optional().nullable()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Invalid activity media'});
  const activity=await prisma.activity.findUnique({where:{id:req.params.id}});
  if(!activity)return res.status(404).json({error:'Activity not found'});
  const max=await prisma.activityImage.aggregate({where:{activityId:activity.id},_max:{sortOrder:true}});
  const item=await prisma.activityImage.create({data:{activityId:activity.id,url:p.data.url,mediaType:p.data.mediaType,altText:p.data.altText,caption:p.data.caption||undefined,sortOrder:(max._max.sortOrder??-1)+1}});
  await audit(req.user!.id,'ACTIVITY_MEDIA_ADDED','ActivityImage',item.id,{activityId:activity.id,mediaType:item.mediaType});
  res.status(201).json(item);
});
app.patch('/api/activities/:activityId/media/:mediaId',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION),async(req:AuthRequest,res)=>{
  const p=z.object({caption:z.string().max(500).optional().nullable(),altText:z.string().max(160).optional().nullable()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Invalid media description'});
  const item=await prisma.activityImage.findFirst({where:{id:req.params.mediaId,activityId:req.params.activityId}});
  if(!item)return res.status(404).json({error:'Activity media not found'});
  const updated=await prisma.activityImage.update({where:{id:item.id},data:{caption:p.data.caption===undefined?undefined:(p.data.caption||null),altText:p.data.altText===undefined?undefined:(p.data.altText||null)}});
  await audit(req.user!.id,'ACTIVITY_MEDIA_UPDATED','ActivityImage',updated.id,{activityId:req.params.activityId});
  res.json(updated);
});
app.delete('/api/activities/:activityId/media/:mediaId',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION),async(req:AuthRequest,res)=>{
  const item=await prisma.activityImage.findFirst({where:{id:req.params.mediaId,activityId:req.params.activityId}});
  if(!item)return res.status(404).json({error:'Activity media not found'});
  await prisma.activityImage.delete({where:{id:item.id}});
  await audit(req.user!.id,'ACTIVITY_MEDIA_DELETED','ActivityImage',item.id,{activityId:req.params.activityId,mediaType:item.mediaType});
  res.json({deleted:true,id:item.id});
});
app.delete('/api/activities/:id',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION),async(req:AuthRequest,res)=>{const a=await prisma.activity.findUnique({where:{id:req.params.id}});if(!a)return res.status(404).json({error:'Activity not found'});await prisma.activity.delete({where:{id:a.id}});await audit(req.user!.id,'ACTIVITY_DELETED','Activity',a.id,{title:a.title});res.json({deleted:true,id:a.id});});

app.get('/api/events',async(_req,res)=>res.json(await prisma.event.findMany({where:{status:{in:[EventStatus.PUBLISHED,EventStatus.COMPLETED]}},orderBy:{startAt:'asc'}})));
app.get('/api/events/all',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION,Role.EVENT_ORGANIZER),async(_req,res)=>res.json(await prisma.event.findMany({include:{registrations:true},orderBy:{startAt:'desc'}})));
app.post('/api/events',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION,Role.EVENT_ORGANIZER),async(req:AuthRequest,res)=>{const p=z.object({title:z.string().min(3),description:z.string().min(3),startAt:z.string(),endAt:z.string().optional(),location:z.string().optional(),coverImageUrl:z.string().url().optional(),status:z.nativeEnum(EventStatus).default(EventStatus.PUBLISHED)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid event'});const e=await prisma.event.create({data:{title:p.data.title,description:p.data.description,startAt:new Date(p.data.startAt),endAt:p.data.endAt?new Date(p.data.endAt):undefined,location:p.data.location,coverImageUrl:p.data.coverImageUrl,status:p.data.status,createdBy:req.user!.id}});await audit(req.user!.id,'EVENT_CREATED','Event',e.id);res.status(201).json(e);});
app.patch('/api/events/:id',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION,Role.EVENT_ORGANIZER),async(req:AuthRequest,res)=>{
  const p=z.object({title:z.string().min(3).optional(),description:z.string().min(3).optional(),startAt:z.string().optional(),endAt:z.string().nullable().optional(),location:z.string().nullable().optional(),coverImageUrl:z.string().url().nullable().optional(),status:z.nativeEnum(EventStatus).optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Invalid event',fields:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const d:any={...p.data}; if(d.startAt!==undefined)d.startAt=new Date(d.startAt); if(d.endAt!==undefined)d.endAt=d.endAt?new Date(d.endAt):null;
  const e=await prisma.event.update({where:{id:req.params.id},data:d,include:{registrations:true}}); await audit(req.user!.id,'EVENT_UPDATED','Event',e.id,{fields:Object.keys(p.data)}); res.json(e);
});
app.delete('/api/events/:id',auth,allow(Role.SUPER_ADMIN,Role.COMMUNICATION,Role.EVENT_ORGANIZER),async(req:AuthRequest,res)=>{const e=await prisma.event.findUnique({where:{id:req.params.id}});if(!e)return res.status(404).json({error:'Event not found'});await prisma.event.delete({where:{id:e.id}});await audit(req.user!.id,'EVENT_DELETED','Event',e.id,{title:e.title});res.json({deleted:true,id:e.id});});
app.post('/api/events/:id/register',auth,async(req:AuthRequest,res)=>{const m=await prisma.member.findUnique({where:{userId:req.user!.id}});if(!m||m.membershipStatus!==MembershipStatus.ACTIVE)return res.status(403).json({error:'An active AIAP membership is required'});try{const r=await prisma.eventRegistration.create({data:{eventId:req.params.id,memberId:m.id}});res.status(201).json(r);}catch{res.status(409).json({error:'Already registered for this event'});}});

app.get('/api/announcements',async(_req,res)=>res.json(await prisma.announcement.findMany({where:{published:true},orderBy:{publishedAt:'desc'}})));
app.get('/api/announcements/all',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT),async(_req,res)=>res.json(await prisma.announcement.findMany({orderBy:{createdAt:'desc'}})));
app.post('/api/announcements',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT),async(req:AuthRequest,res)=>{const p=z.object({title:z.string().min(3),body:z.string().min(3),priority:z.enum(['NORMAL','IMPORTANT','URGENT']).default('NORMAL'),published:z.boolean().default(true)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid announcement'});const a=await prisma.announcement.create({data:{...p.data,createdBy:req.user!.id,publishedAt:p.data.published?new Date():undefined}});await audit(req.user!.id,'ANNOUNCEMENT_CREATED','Announcement',a.id);res.status(201).json(a);});

app.patch('/api/announcements/:id',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT),async(req:AuthRequest,res)=>{
  const p=z.object({title:z.string().min(3).optional(),body:z.string().min(3).optional(),priority:z.enum(['NORMAL','IMPORTANT','URGENT']).optional(),published:z.boolean().optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Invalid announcement',fields:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const d:any={...p.data}; if(d.published!==undefined)d.publishedAt=d.published?new Date():null;
  const a=await prisma.announcement.update({where:{id:req.params.id},data:d}); await audit(req.user!.id,'ANNOUNCEMENT_UPDATED','Announcement',a.id,{fields:Object.keys(p.data)}); res.json(a);
});
app.delete('/api/announcements/:id',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT),async(req:AuthRequest,res)=>{const a=await prisma.announcement.findUnique({where:{id:req.params.id}});if(!a)return res.status(404).json({error:'Announcement not found'});await prisma.announcement.delete({where:{id:a.id}});await audit(req.user!.id,'ANNOUNCEMENT_DELETED','Announcement',a.id,{title:a.title});res.json({deleted:true,id:a.id});});
const financeRoles:Role[]=[Role.SUPER_ADMIN,Role.TREASURER];
const financeManageRoles:Role[]=[Role.SUPER_ADMIN,Role.TREASURER];
const contributionInput=z.object({memberId:z.string().min(1),amount:z.number().positive(),reference:z.string().max(120).optional().nullable(),note:z.string().max(500).optional().nullable(),paidAt:z.string()});
const transactionInput=z.object({type:z.nativeEnum(TransactionType),amount:z.number().positive(),category:z.string().min(2),description:z.string().min(2),receiptUrl:z.string().url().optional().nullable(),occurredAt:z.string()});
const receiptNumber=(id:string, date:Date)=>`AIAP-RCP-${date.getFullYear()}-${id.slice(-8).toUpperCase()}`;
app.get('/api/finance/summary',auth,allow(...financeRoles),async(_req,res)=>{
  const tx=await prisma.transaction.findMany({orderBy:{occurredAt:'desc'}});
  const income=tx.filter(x=>x.type===TransactionType.INCOME).reduce((s,x)=>s+Number(x.amount),0),expense=tx.filter(x=>x.type===TransactionType.EXPENSE).reduce((s,x)=>s+Number(x.amount),0);
  res.json({income,expense,balance:income-expense,transactions:tx.map(t=>({...t,amount:Number(t.amount)}))});
});
app.get('/api/finance/members',auth,allow(...financeRoles),async(_req,res)=>{
  const ms=await prisma.member.findMany({where:{membershipStatus:MembershipStatus.ACTIVE,user:{role:{not:Role.SUPER_ADMIN}}},include:{contributions:{orderBy:{paidAt:'desc'}},user:{select:{role:true}}},orderBy:{fullName:'asc'}});
  res.json(ms.map(m=>({id:m.id,memberNumber:m.memberNumber,fullName:m.fullName,photoUrl:m.photoUrl,city:m.city,fieldOfStudy:m.fieldOfStudy,associationRole:m.user?.role||Role.MEMBER,totalPaid:m.contributions.reduce((s,c)=>s+Number(c.amount),0),contributions:m.contributions.map(c=>({id:c.id,amount:Number(c.amount),reference:c.reference,note:c.note,paidAt:c.paidAt,receiptNumber:receiptNumber(c.id,c.paidAt)}))})));
});
app.post('/api/finance/contributions',auth,allow(...financeManageRoles),async(req:AuthRequest,res)=>{
  const p=contributionInput.safeParse(req.body); if(!p.success)return res.status(400).json({error:'Invalid payment data',fields:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const member=await prisma.member.findUnique({where:{id:p.data.memberId}}); if(!member)return res.status(404).json({error:'Member not found'});
  const paidAt=new Date(p.data.paidAt); if(Number.isNaN(paidAt.getTime()))return res.status(400).json({error:'Invalid payment date'});
  try {
    const result=await prisma.$transaction(async tx=>{
      const c=await tx.contribution.create({data:{memberId:member.id,amount:p.data.amount,reference:p.data.reference||undefined,paidAt,note:p.data.note||undefined,createdBy:req.user!.id}});
      const t=await tx.transaction.create({data:{type:TransactionType.INCOME,amount:p.data.amount,category:'MEMBERSHIP CONTRIBUTION',description:`Contribution — ${member.fullName}`,reference:`CONTRIBUTION:${c.id}`,occurredAt:paidAt,createdBy:req.user!.id}});
      return {c,t};
    });
    await audit(req.user!.id,'CONTRIBUTION_RECORDED','Contribution',result.c.id,{memberId:member.id,amount:p.data.amount,transactionId:result.t.id});
    res.status(201).json({id:result.c.id,member:{id:member.id,fullName:member.fullName,memberNumber:member.memberNumber,city:member.city,photoUrl:member.photoUrl},amount:Number(result.c.amount),reference:result.c.reference||'',note:result.c.note||'',paidAt:result.c.paidAt,receiptNumber:receiptNumber(result.c.id,result.c.paidAt)});
  } catch(e){console.error('Payment record failed:',e);res.status(400).json({error:e instanceof Error?e.message:'Could not record the payment'});}
});
app.patch('/api/finance/contributions/:id',auth,allow(...financeManageRoles),async(req:AuthRequest,res)=>{
  const p=z.object({amount:z.number().positive().optional(),reference:z.string().max(120).optional().nullable(),note:z.string().max(500).optional().nullable(),paidAt:z.string().optional()}).safeParse(req.body); if(!p.success)return res.status(400).json({error:'Invalid payment data'});
  const existing=await prisma.contribution.findUnique({where:{id:req.params.id},include:{member:true}}); if(!existing)return res.status(404).json({error:'Payment not found'});
  const paidAt=p.data.paidAt?new Date(p.data.paidAt):existing.paidAt; if(Number.isNaN(paidAt.getTime()))return res.status(400).json({error:'Invalid payment date'});
  const result=await prisma.$transaction(async tx=>{
    const c=await tx.contribution.update({where:{id:existing.id},data:{amount:p.data.amount??undefined,reference:p.data.reference===undefined?undefined:(p.data.reference||null),note:p.data.note===undefined?undefined:(p.data.note||null),paidAt}});
    await tx.transaction.updateMany({where:{reference:`CONTRIBUTION:${existing.id}`},data:{amount:c.amount,occurredAt:c.paidAt,description:`Contribution — ${existing.member.fullName}`}});
    return c;
  });
  await audit(req.user!.id,'CONTRIBUTION_UPDATED','Contribution',result.id,{fields:Object.keys(p.data)});
  res.json({id:result.id,member:{id:existing.member.id,fullName:existing.member.fullName,memberNumber:existing.member.memberNumber,city:existing.member.city,photoUrl:existing.member.photoUrl},amount:Number(result.amount),reference:result.reference||'',note:result.note||'',paidAt:result.paidAt,receiptNumber:receiptNumber(result.id,result.paidAt)});
});
app.delete('/api/finance/contributions/:id',auth,allow(...financeManageRoles),async(req:AuthRequest,res)=>{
  const existing=await prisma.contribution.findUnique({where:{id:req.params.id},include:{member:true}}); if(!existing)return res.status(404).json({error:'Payment not found'});
  await prisma.$transaction(async tx=>{await tx.transaction.deleteMany({where:{reference:`CONTRIBUTION:${existing.id}`}});await tx.contribution.delete({where:{id:existing.id}});});
  await audit(req.user!.id,'CONTRIBUTION_DELETED','Contribution',existing.id,{memberId:existing.memberId,amount:Number(existing.amount)}); res.json({deleted:true,id:existing.id});
});
app.post('/api/finance/transactions',auth,allow(...financeManageRoles),async(req:AuthRequest,res)=>{
  const p=transactionInput.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid transaction',fields:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const t=await prisma.transaction.create({data:{type:p.data.type,amount:p.data.amount,category:p.data.category,description:p.data.description,receiptUrl:p.data.receiptUrl||undefined,occurredAt:new Date(p.data.occurredAt),createdBy:req.user!.id}}); await audit(req.user!.id,'FINANCE_TRANSACTION_CREATED','Transaction',t.id,{type:p.data.type,amount:p.data.amount});res.status(201).json(t);
});
app.patch('/api/finance/transactions/:id',auth,allow(...financeManageRoles),async(req:AuthRequest,res)=>{
  const p=transactionInput.partial().safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid transaction'});
  const existing=await prisma.transaction.findUnique({where:{id:req.params.id}});if(!existing)return res.status(404).json({error:'Transaction not found'});
  if(existing.reference?.startsWith('CONTRIBUTION:'))return res.status(409).json({error:'Membership payments must be edited from the payment ledger so the receipt and contribution stay synchronized.'});
  const data:any={...p.data};if(data.occurredAt!==undefined)data.occurredAt=new Date(data.occurredAt);const t=await prisma.transaction.update({where:{id:existing.id},data});await audit(req.user!.id,'FINANCE_TRANSACTION_UPDATED','Transaction',t.id,{fields:Object.keys(p.data)});res.json(t);
});
app.delete('/api/finance/transactions/:id',auth,allow(...financeManageRoles),async(req:AuthRequest,res)=>{const existing=await prisma.transaction.findUnique({where:{id:req.params.id}});if(!existing)return res.status(404).json({error:'Transaction not found'});if(existing.reference?.startsWith('CONTRIBUTION:'))return res.status(409).json({error:'Membership payments must be deleted from the payment ledger so the receipt and contribution stay synchronized.'});await prisma.transaction.delete({where:{id:existing.id}});await audit(req.user!.id,'FINANCE_TRANSACTION_DELETED','Transaction',existing.id,{description:existing.description});res.json({deleted:true,id:existing.id});});

const emptyToNull=(schema:any)=>z.preprocess(v=>typeof v==='string'&&v.trim()===''?null:v,schema.nullable().optional());
const memberSelfUpdateSchema=z.object({fullName:z.string().trim().min(2).max(120).optional(),phone:emptyToNull(z.string().trim().min(7,'Enter a valid phone number (at least 7 characters).').max(30)),city:z.string().trim().min(2).max(100).optional(),address:emptyToNull(z.string().max(300)),university:emptyToNull(z.string().max(160)),fieldOfStudy:emptyToNull(z.string().max(160)),photoUrl:emptyToNull(z.string().regex(/^\/uploads\//,'Photo must be uploaded through AIAP.'))});
app.get('/api/me/contributions',auth,allow(Role.MEMBER),async(req:AuthRequest,res)=>{const m=await prisma.member.findUnique({where:{userId:req.user!.id},include:{contributions:{orderBy:{paidAt:'desc'}}}});if(!m)return res.status(404).json({error:'Member profile not found'});res.json({member:{...publicMember(m),phone:m.phone,address:m.address},contributions:m.contributions.map(c=>({id:c.id,amount:Number(c.amount),reference:c.reference||'',note:c.note||'',paidAt:c.paidAt,receiptNumber:receiptNumber(c.id,c.paidAt)}))});});
app.get('/api/me/profile',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT,Role.TREASURER,Role.COMMUNICATION,Role.EVENT_ORGANIZER,Role.COORDINATOR,Role.MEMBER),async(req:AuthRequest,res)=>{
  const m=await prisma.member.findUnique({where:{userId:req.user!.id}});
  if(!m)return res.json(null);
  res.json({...publicMember(m),phone:m.phone,address:m.address,dateOfBirth:m.dateOfBirth,emergencyName:m.emergencyName,emergencyPhone:m.emergencyPhone});
});
app.patch('/api/me/profile',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT,Role.TREASURER,Role.COMMUNICATION,Role.EVENT_ORGANIZER,Role.COORDINATOR,Role.MEMBER),async(req:AuthRequest,res)=>{const p=memberSelfUpdateSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid profile data',fields:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});const m=await prisma.member.findUnique({where:{userId:req.user!.id}});if(!m)return res.status(404).json({error:'Member profile not found'});const updated=await prisma.member.update({where:{id:m.id},data:p.data});await audit(req.user!.id,'OWN_PROFILE_UPDATED','Member',updated.id,{fields:Object.keys(p.data)});res.json(publicMember(updated));});

app.get('/api/me/staff',auth,allow(Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT,Role.TREASURER,Role.COMMUNICATION,Role.EVENT_ORGANIZER,Role.COORDINATOR,Role.MEMBER),async(_req,res)=>{
  const staff=await prisma.user.findMany({where:{role:{in:[Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT,Role.TREASURER,Role.COMMUNICATION,Role.EVENT_ORGANIZER,Role.COORDINATOR]},active:true,member:{isNot:null}},include:{member:true},orderBy:{role:'asc'}});
  res.json(staff.map(u=>({userId:u.id,role:u.role,email:u.email,member:u.member?{id:u.member.id,memberNumber:u.member.memberNumber,fullName:u.member.fullName,photoUrl:u.member.photoUrl,university:u.member.university,phone:u.member.phone,city:u.member.city}:null})));
});
app.get('/api/me/events',auth,allow(Role.MEMBER),async(req:AuthRequest,res)=>{
  const m=await prisma.member.findUnique({where:{userId:req.user!.id}});
  if(!m)return res.status(404).json({error:'Member profile not found'});
  const events=await prisma.event.findMany({where:{status:EventStatus.PUBLISHED},include:{registrations:{where:{memberId:m.id},select:{id:true}}},orderBy:{startAt:'asc'}});
  res.json(events.map(e=>({...e,registered:e.registrations.length>0,registrations:undefined})));
});

const planningRoles:Role[]=[Role.SUPER_ADMIN,Role.EVENT_ORGANIZER];
app.get('/api/event-plans/all',auth,allow(...planningRoles),async(_req,res)=>{
  const plans=await prisma.eventPlan.findMany({include:{event:true,tasks:{orderBy:{sortOrder:'asc'}}},orderBy:{updatedAt:'desc'}});
  res.json(plans.map(p=>({...p,budget:Number(p.budget)})));
});
app.get('/api/events/:id/plan',auth,allow(...planningRoles),async(req,res)=>{const p=await prisma.eventPlan.findUnique({where:{eventId:req.params.id},include:{event:true,tasks:{orderBy:{sortOrder:'asc'}}}});if(!p)return res.status(404).json({error:'Event plan not found'});res.json({...p,budget:Number(p.budget)});});
app.post('/api/events/:id/plan',auth,allow(...planningRoles),async(req:AuthRequest,res)=>{
  const body=z.object({objective:z.string().max(3000).optional().nullable(),expectedAttendance:z.number().int().nonnegative().optional().nullable(),audience:z.string().max(500).optional().nullable(),budget:z.number().nonnegative().optional(),venueDetails:z.string().max(3000).optional().nullable(),transportPlan:z.string().max(3000).optional().nullable(),accommodationPlan:z.string().max(3000).optional().nullable(),cateringPlan:z.string().max(3000).optional().nullable(),securityPlan:z.string().max(3000).optional().nullable(),communicationsPlan:z.string().max(3000).optional().nullable(),contingencyPlan:z.string().max(3000).optional().nullable(),program:z.string().max(5000).optional().nullable(),notes:z.string().max(5000).optional().nullable()}).safeParse(req.body);
  if(!body.success)return res.status(400).json({error:'Invalid event plan',fields:body.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const event=await prisma.event.findUnique({where:{id:req.params.id}});if(!event)return res.status(404).json({error:'Event not found'});
  const plan=await prisma.eventPlan.upsert({where:{eventId:event.id},update:{...body.data,budget:body.data.budget??0},create:{...body.data,budget:body.data.budget??0,eventId:event.id,createdBy:req.user!.id}});
  await audit(req.user!.id,'EVENT_PLAN_SAVED','EventPlan',plan.id,{eventId:event.id});res.json({...plan,budget:Number(plan.budget)});
});
app.post('/api/event-plans/:planId/tasks',auth,allow(...planningRoles),async(req:AuthRequest,res)=>{
 const p=z.object({title:z.string().min(2).max(200),description:z.string().max(1000).optional().nullable(),assignee:z.string().max(160).optional().nullable(),dueAt:z.string().optional().nullable(),priority:z.enum(['LOW','MEDIUM','HIGH','URGENT']).default('MEDIUM'),status:z.enum(['TODO','IN_PROGRESS','DONE']).default('TODO')}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid planning task'});
 const plan=await prisma.eventPlan.findUnique({where:{id:req.params.planId}});if(!plan)return res.status(404).json({error:'Event plan not found'});
 const max=await prisma.eventPlanTask.aggregate({where:{planId:plan.id},_max:{sortOrder:true}});const task=await prisma.eventPlanTask.create({data:{planId:plan.id,title:p.data.title,description:p.data.description||undefined,assignee:p.data.assignee||undefined,dueAt:p.data.dueAt?new Date(p.data.dueAt):undefined,priority:p.data.priority,status:p.data.status,sortOrder:(max._max.sortOrder??-1)+1}});
 await audit(req.user!.id,'EVENT_PLAN_TASK_CREATED','EventPlanTask',task.id,{planId:plan.id});res.status(201).json(task);
});
app.patch('/api/event-plans/:planId/tasks/:taskId',auth,allow(...planningRoles),async(req:AuthRequest,res)=>{const p=z.object({title:z.string().min(2).max(200).optional(),description:z.string().max(1000).nullable().optional(),assignee:z.string().max(160).nullable().optional(),dueAt:z.string().nullable().optional(),priority:z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(),status:z.enum(['TODO','IN_PROGRESS','DONE']).optional()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid planning task'});const task=await prisma.eventPlanTask.findFirst({where:{id:req.params.taskId,planId:req.params.planId}});if(!task)return res.status(404).json({error:'Planning task not found'});const d:any={...p.data};if(d.dueAt!==undefined)d.dueAt=d.dueAt?new Date(d.dueAt):null;const out=await prisma.eventPlanTask.update({where:{id:task.id},data:d});await audit(req.user!.id,'EVENT_PLAN_TASK_UPDATED','EventPlanTask',out.id,{planId:req.params.planId});res.json(out);});
app.delete('/api/event-plans/:planId/tasks/:taskId',auth,allow(...planningRoles),async(req:AuthRequest,res)=>{const task=await prisma.eventPlanTask.findFirst({where:{id:req.params.taskId,planId:req.params.planId}});if(!task)return res.status(404).json({error:'Planning task not found'});await prisma.eventPlanTask.delete({where:{id:task.id}});await audit(req.user!.id,'EVENT_PLAN_TASK_DELETED','EventPlanTask',task.id,{planId:req.params.planId});res.json({deleted:true,id:task.id});});

app.get('/api/dashboard',auth,allow(Role.SUPER_ADMIN,Role.PRESIDENT,Role.VICE_PRESIDENT,Role.SECRETARIAT,Role.TREASURER,Role.COMMUNICATION,Role.EVENT_ORGANIZER,Role.COORDINATOR),async(req:AuthRequest,res)=>{
  const associationUserFilter={role:{not:Role.SUPER_ADMIN}};
  const rows=await prisma.member.findMany({where:{membershipStatus:MembershipStatus.ACTIVE,user:associationUserFilter},select:{city:true,university:true,fieldOfStudy:true,status:true,user:{select:{role:true}}}});
  const pending=await prisma.member.count({where:{membershipStatus:MembershipStatus.PENDING,user:associationUserFilter}});
  const [activities,events,announcements,activityImages,activityVideos,activityParticipants,upcomingEvents,plannedEvents,overdueTasks]=await Promise.all([
    prisma.activity.count({where:{published:true}}),prisma.event.count({where:{status:EventStatus.PUBLISHED}}),prisma.announcement.count({where:{published:true}}),
    prisma.activityImage.count({where:{mediaType:'IMAGE',activity:{published:true}}}),prisma.activityImage.count({where:{mediaType:'VIDEO',activity:{published:true}}}),prisma.activityParticipation.count({where:{activity:{published:true}}}),
    prisma.event.count({where:{status:EventStatus.PUBLISHED,startAt:{gte:new Date()}}}),prisma.eventPlan.count(),prisma.eventPlanTask.count({where:{status:{not:'DONE'},dueAt:{lt:new Date()}}})
  ]);
  const norm=(v:any)=>String(v??'').trim().toLowerCase();
  // Membership type is determined consistently from the dedicated status field,
  // Membership type is determined exclusively by the dedicated status field. Super Admin is excluded by userWhere.
  const isStudent=(r:any)=>norm(r.status)==='student';
  const isProfessional=(r:any)=>norm(r.status)==='professional';
  const students=rows.filter(isStudent).length;
  const nonStudents=Math.max(0,rows.length-students);
  const professionals=rows.filter(isProfessional).length;
  const unique=(key:string,predicate?:(r:any)=>boolean)=>new Set(rows.filter(predicate||(()=>true)).map((r:any)=>String(r[key]??'').trim()).filter(Boolean)).size;
  const studentUniversities=unique('university',isStudent);
  const coordinatorMember=req.user?.role===Role.COORDINATOR?await prisma.member.findFirst({where:{userId:req.user.id},select:{city:true}}):null;
  const cityName=String(coordinatorMember?.city??'').trim();
  const cityRows=cityName?rows.filter((r:any)=>norm(r.city)===norm(cityName)):[];
  const cityStudents=cityRows.filter(isStudent).length;
  const cityNonStudents=Math.max(0,cityRows.length-cityStudents);
  res.json({members:rows.length,pending,activities,events,announcements,students,nonStudents,professionals,activityMemories:activityImages,activityVideos,activityParticipants,upcomingEvents,plannedEvents,overdueTasks,universities:unique('university'),studentUniversities,fields:unique('fieldOfStudy'),cities:unique('city'),cityName,cityMembers:cityRows.length,cityStudents,cityNonStudents});
});
app.get('/api/audit-logs',auth,allow(Role.SUPER_ADMIN),async(_req,res)=>res.json(await prisma.auditLog.findMany({orderBy:{createdAt:'desc'},take:200}))); 

app.use((_req,res)=>res.status(404).json({error:'Not found'}));
app.use((err:any,_req:Request,res:Response,_next:NextFunction)=>{console.error(err);res.status(500).json({error:err?.message || 'Internal server error'});});

async function reconcileAssociationMembers(){
  const associationUsers=await prisma.user.findMany({where:{role:{in:associationRoles}},include:{member:true}});
  for(const u of associationUsers){
    if(!u.member){
      await prisma.member.create({data:{userId:u.id,fullName:u.email.split('@')[0],city:'Visakhapatnam',status:'Other',membershipStatus:MembershipStatus.ACTIVE,approvedAt:new Date(),memberNumber:`AIAP-${new Date().getFullYear()}-${crypto.randomInt(10000,99999)}`}});
    } else if(u.member.membershipStatus!==MembershipStatus.ACTIVE){
      await prisma.member.update({where:{id:u.member.id},data:{membershipStatus:MembershipStatus.ACTIVE,approvedAt:u.member.approvedAt||new Date(),memberNumber:u.member.memberNumber||`AIAP-${new Date().getFullYear()}-${crypto.randomInt(10000,99999)}`}});
    }
    if(!u.active) await prisma.user.update({where:{id:u.id},data:{active:true}});
  }
}

async function syncPasswordResetFlags(){
  const users=await prisma.user.findMany({select:{id:true,mustChangePassword:true}});
  const latestAllReset=await prisma.auditLog.findFirst({where:{action:'ALL_PASSWORDS_RESET',entity:'User'},orderBy:{createdAt:'desc'},select:{createdAt:true}});
  const resetLogs=await prisma.auditLog.findMany({where:{action:'PASSWORD_RESET',entity:'User',entityId:{not:null}},orderBy:{createdAt:'desc'},select:{actorUserId:true,entityId:true,createdAt:true}});
  const changeLogs=await prisma.auditLog.findMany({where:{action:'PASSWORD_CHANGED',entity:'User',entityId:{not:null}},orderBy:{createdAt:'desc'},select:{entityId:true,createdAt:true}});
  const latestResetByUser=new Map<string,Date>();
  for(const l of resetLogs) if(l.entityId&&!latestResetByUser.has(l.entityId)) latestResetByUser.set(l.entityId,l.createdAt);
  const latestChangeByUser=new Map<string,Date>();
  for(const l of changeLogs) if(l.entityId&&!latestChangeByUser.has(l.entityId)) latestChangeByUser.set(l.entityId,l.createdAt);
  for(const u of users){
    const userReset=latestResetByUser.get(u.id); const resetAt=latestAllReset && (!userReset || latestAllReset.createdAt>userReset)?latestAllReset.createdAt:userReset;
    const changeAt=latestChangeByUser.get(u.id);
    const shouldForce=!!resetAt && (!changeAt || resetAt>changeAt);
    if(shouldForce!==u.mustChangePassword) await prisma.user.update({where:{id:u.id},data:{mustChangePassword:shouldForce}});
  }
}

reconcileAssociationMembers().then(()=>syncPasswordResetFlags()).then(()=>app.listen(port,()=>console.log(`AIAP API running on http://localhost:${port}`))).catch(err=>{console.error('Unable to initialize AIAP API:',err);process.exit(1)});
process.on('SIGINT',async()=>{await prisma.$disconnect();process.exit(0)});
