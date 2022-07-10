using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
namespace clinicHealth.Pages.DoctorPage
{
    public class editpatientModel : PageModel
    {
        public Patients patient = new Patients();
        public String errorMessage = "";
        public String successMessage = "";
        public void OnGet()
        {
            String id = Request.Query["id"];
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "Select * from Patient where id=@id ";
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@id", Convert.ToInt32(id));
                        using (SqlDataReader reader = command.ExecuteReader())
                            if (reader.Read())
                            {

                                patient.id = reader.GetInt32(0);
                                patient.full_name = reader.GetString(1);
                                patient.year_of_birth = reader.GetString(2);
                                patient.Age = reader.GetInt32(3);
                                patient.Symptoms = reader.GetString(4);
                                patient.Allergies = reader.GetString(5);
                                patient.visit_date = reader.GetString(6);

                            }
                    }
                }

            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
            }
        }
        public void OnPost()
        {
            
            patient.id = Convert.ToInt32(Request.Form["id"]);
            patient.full_name = Request.Form["name"];
            patient.year_of_birth = Request.Form["year"];
            patient.Age = Convert.ToInt32(Request.Form["Age"]);
            patient.Symptoms = Request.Form["Sym"];
            patient.Allergies = Request.Form["All"];
            patient.visit_date = Request.Form["Visit"];
           
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "UPDATE Patient SET full_name=@name,year_of_birth=@year,Age=@age,Symptoms=@Sym,Allergies=@All,visit_date=@date WHERE id=@id";
                    using (SqlCommand command = new SqlCommand(doctorQuery,connection))
                    {
                        command.Parameters.AddWithValue("@name", patient.full_name);
                        command.Parameters.AddWithValue("@year", patient.year_of_birth);
                        command.Parameters.AddWithValue("@age", patient.Age);
                        command.Parameters.AddWithValue("@Sym", patient.Symptoms);
                        command.Parameters.AddWithValue("@All", patient.Allergies);
                        command.Parameters.AddWithValue("@date", patient.visit_date);
                        command.Parameters.AddWithValue("@id", patient.id);

                        command.ExecuteNonQuery();
                    }
                }

            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return;
            }
            Response.Redirect("/DoctorPage/patient?id=" + Convert.ToInt32(Request.Query["id"])+"");
        }
    } }
