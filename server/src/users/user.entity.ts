import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', unique: true, nullable: true }) phone: string | null;
  @Column({ type: 'varchar', unique: true, nullable: true }) email: string | null;
  @Column({ type: 'varchar', nullable: true }) passwordHash: string | null;
  @Column({ type: 'varchar', length: 2, default: 'en' }) language: 'en' | 'ne';
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
