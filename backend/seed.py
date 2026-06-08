#!/usr/bin/env python3
"""Seed the database with sample family data for Memoir."""

import sys
import os
import uuid
from datetime import datetime, date

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database.models import (
    Base, User, Family, FamilyMember, Person, Relationship, Memory, MemoryPhoto,
    MemberRole, RelationshipTag
)
from backend.database.config import engine, SessionLocal, init_db
from passlib.context import CryptContext

# Set UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed():
    print("== Seeding Memoir database... ==")
    
    # Initialize database
    init_db()
    db = SessionLocal()
    
    try:
        # Check if already seeded
        existing = db.query(Family).first()
        if existing:
            print("Database already seeded. Skipping.")
            return
        
        # ---- Create Users ----
        users_data = [
            {"name": "Karthik", "email": "karthik@example.com", "password": "password123"},
            {"name": "Priya", "email": "priya@example.com", "password": "password123"},
            {"name": "Rajan", "email": "rajan@example.com", "password": "password123"},
            {"name": "Ananya", "email": "ananya@example.com", "password": "password123"},
        ]
        
        users = []
        for ud in users_data:
            user = User(
                id=uuid.uuid4(),
                name=ud["name"],
                email=ud["email"],
                password_hash=pwd_context.hash(ud["password"][:72]),
            )
            db.add(user)
            users.append(user)
        db.flush()
        
        print(f"  + Created {len(users)} users")
        
        # ---- Create Family ----
        family = Family(
            id=uuid.uuid4(),
            name="The Motupalli Family",
            created_by=users[0].id,  # Karthik is admin
        )
        db.add(family)
        db.flush()
        
        # Add members
        for user in users:
            member = FamilyMember(
                id=uuid.uuid4(),
                user_id=user.id,
                family_id=family.id,
                role=MemberRole.admin if user == users[0] else MemberRole.member,
            )
            db.add(member)
        db.flush()
        
        print(f"  + Created family: {family.name}")
        
        # ---- Create People ----
        people_data = [
            {
                "name": "Dadi",
                "relationship_tag": RelationshipTag.Grandparent,
                "bio": "Born in 1942 in Vizag. A wonderful grandmother who makes the best biryani. She lived through India's independence and has countless stories of growing up in a small coastal town. She taught all her grandchildren how to cook family recipes.",
                "dob": date(1942, 3, 15),
            },
            {
                "name": "Thatha",
                "relationship_tag": RelationshipTag.Grandparent,
                "bio": "Born in 1938. A retired school teacher who loved gardening and classical music. He built the family home with his own hands and instilled the value of education in everyone.",
                "dob": date(1938, 11, 2),
            },
            {
                "name": "Dad",
                "relationship_tag": RelationshipTag.Parent,
                "bio": "A bank manager who loves cricket and old Hindi movies. Known for his sense of humor and ability to fix anything around the house.",
                "dob": date(1965, 7, 20),
            },
            {
                "name": "Mom",
                "relationship_tag": RelationshipTag.Parent,
                "bio": "A talented home chef and the heart of the family. She keeps everyone connected and organized. Known for her annual Diwali gatherings that bring the whole extended family together.",
                "dob": date(1968, 1, 10),
            },
            {
                "name": "Karthik",
                "relationship_tag": RelationshipTag.Child,
                "bio": "The eldest child, now working as a software engineer. Loves photography and documenting family moments.",
                "dob": date(1995, 9, 5),
            },
        ]
        
        people = []
        for pd in people_data:
            person = Person(
                id=uuid.uuid4(),
                family_id=family.id,
                name=pd["name"],
                relationship_tag=pd["relationship_tag"],
                bio=pd["bio"],
                dob=pd["dob"],
                photo_url=f"https://picsum.photos/seed/{pd['name'].lower().replace(' ', '')}/400/300",
                created_by=users[0].id,
            )
            db.add(person)
            people.append(person)
        db.flush()
        
        print(f"  + Created {len(people)} people")
        
        # ---- Create Relationships ----
        relationships_data = [
            (people[3], people[2], "Married"),         # Mom - Dad
            (people[0], people[2], "Mother-Son"),       # Dadi - Dad
            (people[1], people[2], "Father-Son"),       # Thatha - Dad
            (people[2], people[4], "Father-Son"),       # Dad - Karthik
            (people[3], people[4], "Mother-Son"),       # Mom - Karthik
        ]
        
        for person_a, person_b, label in relationships_data:
            rel = Relationship(
                id=uuid.uuid4(),
                family_id=family.id,
                person_a_id=person_a.id,
                person_b_id=person_b.id,
                label=label,
            )
            db.add(rel)
        db.flush()
        
        print(f"  + Created {len(relationships_data)} relationships")
        
        # ---- Create Memories ----
        memories_data = [
            {
                "person": people[0],  # Dadi
                "title": "Childhood summers in Vizag",
                "story_text": "I remember running through the narrow lanes of Vizag during summer vacations. The smell of fresh fish from the harbor, the sound of waves crashing against the rocks at RK Beach. We would collect seashells and my mother would make us lemonade with the perfect amount of salt and sugar.",
                "memory_date": date(1960, 6, 1),
            },
            {
                "person": people[0],  # Dadi
                "title": "Learning to cook family recipes",
                "story_text": "My grandmother taught me her secret recipe for chicken biryani. She said the key was in the patience -- letting the meat marinate for hours and layering the rice just right. It took me three tries to get it perfect, and when I did, the whole family applauded.",
                "memory_date": date(1975, 8, 15),
            },
            {
                "person": people[1],  # Thatha
                "title": "Building the family home",
                "story_text": "We built this house brick by brick. I designed the layout myself -- a courtyard in the middle where the whole family could gather under the stars. Every evening we would sit there, and I would tell stories from the Mahabharata to the children.",
                "memory_date": date(1970, 3, 10),
            },
            {
                "person": people[1],  # Thatha
                "title": "Retirement and gardening",
                "story_text": "After retiring from teaching, I finally had time for my true passion -- gardening. The backyard transformed into a small paradise with roses, jasmine, and a mango tree that bears the sweetest fruit in the neighborhood.",
                "memory_date": date(1998, 4, 1),
            },
            {
                "person": people[2],  # Dad
                "title": "Our first family trip to Tirupati",
                "story_text": "We took the train from Vizag to Tirupati. It was a 12-hour journey but Karthik was so excited he didn't sleep a wink. The queue for darshan was 6 hours long, but the moment we saw the deity, everything melted away. One of the most peaceful moments of my life.",
                "memory_date": date(2004, 12, 25),
            },
            {
                "person": people[2],  # Dad
                "title": "Teaching Karthik to ride a bike",
                "story_text": "I'll never forget the look on his face when he first rode without training wheels. He was so scared, but I held the back of the seat and ran alongside him. When he finally got it, he shouted 'Look Dad, no hands!' and promptly crashed into a bush. We both laughed about it for weeks.",
                "memory_date": date(2002, 8, 5),
            },
            {
                "person": people[3],  # Mom
                "title": "The great Diwali of 2008",
                "story_text": "That year, I decided to host Diwali for the entire extended family -- 35 people! I started preparing a week in advance. Made 12 different sweets, decorated every corner of the house with diyas and rangoli. The kids did a small skit about Ramayana, and we ended the night with fireworks on the terrace. Everyone said it was the best Diwali ever.",
                "memory_date": date(2008, 10, 28),
            },
            {
                "person": people[3],  # Mom
                "title": "Karthik's first day of school",
                "story_text": "I was more nervous than he was. Ironed his little uniform three times, packed his favorite lunch -- pesarattu with ginger chutney. When I dropped him off, he walked right in without looking back. I stood there for 10 minutes peering through the window. The teachers had to ask me to leave.",
                "memory_date": date(1999, 6, 15),
            },
            {
                "person": people[4],  # Karthik
                "title": "Learning guitar from YouTube",
                "story_text": "During the lockdown, I decided to finally learn guitar. Dad thought I was crazy ordering a guitar online, but Mom supported me. After three months of practicing, I could play 'Hotel California' -- badly, but I could play it. Now every family gathering ends with me being forced to perform.",
                "memory_date": date(2020, 7, 12),
            },
            {
                "person": people[4],  # Karthik
                "title": "Road trip to Hampi",
                "story_text": "My best friend and I took a road trip to Hampi last summer. We got lost three times, ate at a dhaba that gave us food poisoning, and slept in a hostel that looked like a prison. But seeing the sunrise over the Vijayanagara ruins made it all worthwhile. I took over 500 photos.",
                "memory_date": date(2024, 3, 20),
            },
        ]
        
        for md in memories_data:
            memory = Memory(
                id=uuid.uuid4(),
                person_id=md["person"].id,
                family_id=family.id,
                title=md["title"],
                story_text=md["story_text"],
                memory_date=md["memory_date"],
                created_by_user_id=users[0].id,
            )
            db.add(memory)
            db.flush()
            
            # Add placeholder photo
            photo = MemoryPhoto(
                id=uuid.uuid4(),
                memory_id=memory.id,
                photo_url=f"https://picsum.photos/seed/{memory.id}/800/600",
                display_order=0,
            )
            db.add(photo)
        
        db.commit()
        print(f"  + Created {len(memories_data)} memories")
        
        print()
        print("== Seeding complete! ==")
        print("   Login: karthik@example.com / password123")
        print("   Or any of: priya, rajan, ananya @example.com / password123")
        
    except Exception as e:
        db.rollback()
        print(f"!! Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
